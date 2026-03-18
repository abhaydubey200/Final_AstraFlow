# Database Design

## Tables

### connections

* id
* name
* connector_type
* config (JSON encrypted)
* status
* created_at

### schemas

* id
* connection_id
* schema_name

### tables

* id
* schema_id
* table_name
* columns (JSON)

### sync_config

* id
* table_id
* sync_mode
* cursor_field
