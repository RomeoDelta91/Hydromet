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
