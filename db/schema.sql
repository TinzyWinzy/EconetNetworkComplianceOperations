-- Pilot schema — corrected per technical-specs-erd risk fixes.
-- Zero-PII: subscribers carry hashed_msisdn only. Telemetry uses a plain
-- single-column PK for the pilot (partitioning deferred to national scale).

-- 1. Towers asset table
CREATE TABLE IF NOT EXISTS towers (
    tower_id SERIAL PRIMARY KEY,
    tower_code VARCHAR(10) NOT NULL UNIQUE,          -- T001..T100 pilot codes
    tower_name VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'DEGRADED', 'DOWN')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- GIS columns (Phase 0): deterministic Harare-region coordinates for the map.
ALTER TABLE towers ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6);
ALTER TABLE towers ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);

-- 2. Tower telemetry (hourly snapshots; pilot writes on poll, capped by cleanup job)
CREATE TABLE IF NOT EXISTS tower_telemetry_hourly (
    telemetry_id BIGSERIAL PRIMARY KEY,
    tower_id INTEGER NOT NULL REFERENCES towers(tower_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cell_availability_pct DECIMAL(5,2) NOT NULL CHECK (cell_availability_pct BETWEEN 0.00 AND 100.00),
    dsasr_pct DECIMAL(5,2) NOT NULL CHECK (dsasr_pct BETWEEN 0.00 AND 100.00),
    dsdr_pct DECIMAL(5,2) NOT NULL CHECK (dsdr_pct BETWEEN 0.00 AND 100.00),
    dcr_pct DECIMAL(5,2) NOT NULL CHECK (dcr_pct BETWEEN 0.00 AND 100.00),
    cssr_pct DECIMAL(5,2) NOT NULL CHECK (cssr_pct BETWEEN 0.00 AND 100.00),
    status VARCHAR(20) NOT NULL DEFAULT 'Online',
    active_outage_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_telemetry_tower_time ON tower_telemetry_hourly(tower_id, recorded_at DESC);

-- 3. QoS compliance alerts (retained per-tower breach record for filings)
CREATE TABLE IF NOT EXISTS qos_compliance_alerts (
    alert_id SERIAL PRIMARY KEY,
    tower_id INTEGER NOT NULL REFERENCES towers(tower_id) ON DELETE CASCADE,
    kpi_metric VARCHAR(50) NOT NULL CHECK (kpi_metric IN ('CA', 'DSASR', 'DSDR', 'DCR', 'CSSR')),
    current_value DECIMAL(5,2) NOT NULL,
    target_limit DECIMAL(5,2) NOT NULL,
    alert_level VARCHAR(20) DEFAULT 'MEDIUM' CHECK (alert_level IN ('MEDIUM', 'HIGH', 'BREACH')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON qos_compliance_alerts(alert_level, resolved_at) WHERE resolved_at IS NULL;

-- 4. Subscribers — hashed identity only, never raw MSISDN
CREATE TABLE IF NOT EXISTS subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    hashed_msisdn CHAR(64) NOT NULL UNIQUE,
    hsm_key_id VARCHAR(50) NOT NULL DEFAULT 'neon-pilot-salt-v1',
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'THROTTLED')),
    data_balance_bytes BIGINT NOT NULL DEFAULT 0,
    fup_throttled BOOLEAN DEFAULT FALSE,
    fup_limit_gb DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Crew assignments (survives refresh — the state that used to evaporate)
CREATE TABLE IF NOT EXISTS crew_assignments (
    tower_code VARCHAR(10) PRIMARY KEY,
    crew VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    note VARCHAR(255) DEFAULT 'Diesel + traffic shift',
    assigned_by VARCHAR(50) DEFAULT 'NOC Operator'
);

-- 6. Shift audit log (append-only; basis of POTRAZ evidence)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id BIGSERIAL PRIMARY KEY,
    logged_at TIMESTAMPTZ NOT NULL,
    actor VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    detail TEXT NOT NULL
);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS logged_dedup_key TEXT;
UPDATE audit_log SET logged_dedup_key = logged_at::text || '|' || actor || '|' || action || '|' || detail WHERE logged_dedup_key IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_log_dedup ON audit_log (logged_dedup_key);

-- 7. Care resolutions (each row = one deflected call-centre ticket)
CREATE TABLE IF NOT EXISTS care_resolutions (
    resolution_id BIGSERIAL PRIMARY KEY,
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    detail TEXT NOT NULL,
    resolved_by VARCHAR(50) DEFAULT 'Care Agent'
);
