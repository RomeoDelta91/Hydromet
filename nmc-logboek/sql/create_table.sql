CREATE TABLE wp_nmc_logboek (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  uuid          VARCHAR(36)  NOT NULL UNIQUE,
  type          ENUM('forecaster','observer') NOT NULL,
  datum         DATE         NOT NULL,
  shift         VARCHAR(80)  NOT NULL,
  ingevuld_door VARCHAR(80),
  meteoroloog   VARCHAR(80),              -- voor forecaster: naam hoofdmeteroloog
  ts_created    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ts_updated    DATETIME     ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     DEFAULT NULL, -- soft delete
  data_json     LONGTEXT     NOT NULL,    -- volledige entry als JSON

  INDEX idx_datum        (datum),
  INDEX idx_type_datum   (type, datum),
  INDEX idx_shift        (datum, shift),
  INDEX idx_deleted      (deleted_at),

  UNIQUE KEY uniq_shift (datum, shift, type, meteoroloog)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Normalized child table: one row per adjunct-meteoroloog per observer shift.
-- Lets you query/report per person directly in SQL instead of parsing data_json.
CREATE TABLE wp_nmc_logboek_personen (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  logboek_id      INT          NOT NULL,
  naam            VARCHAR(80)  NOT NULL,
  werktijd_van    VARCHAR(8),
  werktijd_tot    VARCHAR(8),
  synop_totaal    INT          DEFAULT 0,
  metar_totaal    INT          DEFAULT 0,
  klima_totaal    INT          DEFAULT 0,
  taf_totaal      INT          DEFAULT 0,

  INDEX idx_naam       (naam),
  INDEX idx_logboek_id (logboek_id),

  FOREIGN KEY (logboek_id) REFERENCES wp_nmc_logboek(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
