import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from services.scheduler_service import SchedulerService

@pytest.fixture
def mock_pool():
    pool = MagicMock()
    conn = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = conn
    return pool, conn

@pytest.mark.asyncio
async def test_schedule_ready_tasks_no_active_runs(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    conn.fetch.return_value = [] # No active runs
    
    await scheduler.schedule_ready_tasks()
    
    conn.fetch.assert_called_once_with("SELECT id, pipeline_id FROM public.pipeline_runs WHERE run_status = 'running'")
    # Should return early and not call anything else
    assert conn.fetch.call_count == 1

@pytest.mark.asyncio
async def test_schedule_ready_tasks_with_ready_tasks(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    
    run_id = str(uuid.uuid4())
    pipeline_id = str(uuid.uuid4())
    task_id = str(uuid.uuid4())
    
    # 1. Active runs
    conn.fetch.side_effect = [
        [{'id': run_id, 'pipeline_id': pipeline_id}], # active_runs
        [{'id': task_id, 'task_name': 'Task 1'}],   # tasks
        [],                                         # deps (no dependencies)
        []                                          # task_runs (none yet)
    ]
    
    # Mocking _batch_queue_tasks to verify it gets called
    with patch.object(SchedulerService, '_batch_queue_tasks', new_callable=AsyncMock) as mock_batch:
        await scheduler.schedule_ready_tasks()
        mock_batch.assert_called_once()
        args = mock_batch.call_args[0]
        assert args[1] == run_id
        assert args[2] == [task_id]

@pytest.mark.asyncio
async def test_schedule_ready_tasks_dependency_resolution(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    
    run_id = str(uuid.uuid4())
    pipeline_id = str(uuid.uuid4())
    t1_id = str(uuid.uuid4())
    t2_id = str(uuid.uuid4())
    
    # T1 -> T2
    conn.fetch.side_effect = [
        [{'id': run_id, 'pipeline_id': pipeline_id}], # active_runs
        [{'id': t1_id, 'task_name': 'T1'}, {'id': t2_id, 'task_name': 'T2'}], # tasks
        [{'parent_task_id': t1_id, 'child_task_id': t2_id}], # deps
        [{'task_id': t1_id, 'status': 'completed', 'next_retry_at': None}] # task_runs (T1 done)
    ]
    
    with patch.object(SchedulerService, '_batch_queue_tasks', new_callable=AsyncMock) as mock_batch:
        await scheduler.schedule_ready_tasks()
        # Should only queue T2 because T1 is completed
        mock_batch.assert_called_once()
        assert mock_batch.call_args[0][2] == [t2_id]

@pytest.mark.asyncio
async def test_schedule_ready_tasks_skips_running_failed_completed(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    
    run_id = str(uuid.uuid4())
    pipeline_id = str(uuid.uuid4())
    t1_id = str(uuid.uuid4())
    t2_id = str(uuid.uuid4())
    t3_id = str(uuid.uuid4())
    
    conn.fetch.side_effect = [
        [{'id': run_id, 'pipeline_id': pipeline_id}], # active_runs
        [{'id': t1_id, 'task_name': 'T1'}, {'id': t2_id, 'task_name': 'T2'}, {'id': t3_id, 'task_name': 'T3'}], # tasks
        [], # deps (no deps)
        [
            {'task_id': t1_id, 'status': 'completed', 'next_retry_at': None},
            {'task_id': t2_id, 'status': 'running', 'next_retry_at': None},
            {'task_id': t3_id, 'status': 'failed', 'next_retry_at': None}
        ]
    ]
    
    with patch.object(SchedulerService, '_batch_queue_tasks', new_callable=AsyncMock) as mock_batch:
        await scheduler.schedule_ready_tasks()
        # None should be queued
        mock_batch.assert_not_called()

@pytest.mark.asyncio
async def test_schedule_ready_tasks_retry_logic(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    
    run_id = str(uuid.uuid4())
    pipeline_id = str(uuid.uuid4())
    t1_id = str(uuid.uuid4())
    
    future_time = datetime.now() + timedelta(minutes=5)
    past_time = datetime.now() - timedelta(minutes=5)

    # Test Case 1: Retry in future -> Skip
    conn.fetch.side_effect = [
        [{'id': run_id, 'pipeline_id': pipeline_id}], # active_runs
        [{'id': t1_id, 'task_name': 'T1'}], # tasks
        [], # deps
        [{'task_id': t1_id, 'status': 'retrying', 'next_retry_at': future_time}] # task_runs
    ]
    
    with patch.object(SchedulerService, '_batch_queue_tasks', new_callable=AsyncMock) as mock_batch:
        await scheduler.schedule_ready_tasks()
        mock_batch.assert_not_called()

    # Test Case 2: Retry in past -> Queue
    conn.fetch.side_effect = [
        [{'id': run_id, 'pipeline_id': pipeline_id}], # active_runs
        [{'id': t1_id, 'task_name': 'T1'}], # tasks
        [], # deps
        [{'task_id': t1_id, 'status': 'retrying', 'next_retry_at': past_time}] # task_runs
    ]
    
    with patch.object(SchedulerService, '_batch_queue_tasks', new_callable=AsyncMock) as mock_batch:
        await scheduler.schedule_ready_tasks()
        mock_batch.assert_called_once()


@pytest.mark.asyncio
async def test_batch_queue_tasks_executemany(mock_pool):
    pool, conn = mock_pool
    scheduler = SchedulerService(pool)
    
    run_id = str(uuid.uuid4())
    task_ids = [str(uuid.uuid4()) for _ in range(5)]
    
    await scheduler._batch_queue_tasks(conn, run_id, task_ids)
    
    conn.executemany.assert_called_once()
    query, data = conn.executemany.call_args[0]
    assert "INSERT INTO public.task_runs" in query
    assert len(data) == 5
    assert data[0] == (run_id, task_ids[0])
