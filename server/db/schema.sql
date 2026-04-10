-- ============================================================
-- Smart Timetable Architect — Phase 1
-- Full Database Schema
-- Engine: MySQL 8.0+  |  Charset: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS timetable_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE timetable_db;

-- ============================================================
-- 1. teachers
--    Stores all teaching faculty members.
--    Email is the natural unique key used for CSV upserts.
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id                 INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name               VARCHAR(150)    NOT NULL,
  department         VARCHAR(100)    NOT NULL DEFAULT '',
  email              VARCHAR(191)    NOT NULL,
  max_hours_per_week INT UNSIGNED    NOT NULL DEFAULT 20,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_teacher_email      (email),
  INDEX        idx_teacher_dept     (department)
) ENGINE=InnoDB
  COMMENT='Registered teaching faculty';


-- ============================================================
-- 2. subjects
--    One row per academic subject.
--    teacher1_id and teacher2_id are the primary and
--    secondary teachers responsible for the subject.
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id                      INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  name                    VARCHAR(200)       NOT NULL,
  code                    VARCHAR(50)        NOT NULL   COMMENT 'e.g. CS301',
  paper_code              VARCHAR(50)        NOT NULL DEFAULT '' COMMENT 'e.g. CS-P-301',
  department              VARCHAR(100)       NOT NULL,
  year                    ENUM('FY','SY','TY') NOT NULL COMMENT 'First/Second/Third Year',
  credits                 TINYINT UNSIGNED   NOT NULL DEFAULT 4,
  total_semester_hours    SMALLINT UNSIGNED  NOT NULL COMMENT 'Σ of all module hours',
  expected_hours_per_week TINYINT UNSIGNED   NOT NULL DEFAULT 1 COMMENT 'Weekly slot target for Phase 2 scheduler',
  teacher1_id             INT UNSIGNED       DEFAULT NULL,
  teacher2_id             INT UNSIGNED       DEFAULT NULL,
  created_at              TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_subject_code       (code),
  INDEX        idx_subject_dept     (department),
  INDEX        idx_subject_year     (year),
  INDEX        idx_subject_t1       (teacher1_id),
  INDEX        idx_subject_t2       (teacher2_id),

  CONSTRAINT fk_subject_teacher1
    FOREIGN KEY (teacher1_id) REFERENCES teachers (id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_subject_teacher2
    FOREIGN KEY (teacher2_id) REFERENCES teachers (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='Academic subjects offered per department and year';


-- ============================================================
-- 3. subject_modules
--    One row per module (unit) within a subject.
--    assigned_teacher_id resolves which teacher covers this
--    specific module (teacher1 or teacher2 from subjects).
-- ============================================================
CREATE TABLE IF NOT EXISTS subject_modules (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  subject_id          INT UNSIGNED  NOT NULL,
  module_number       TINYINT UNSIGNED NOT NULL COMMENT '1-based module index',
  module_name         VARCHAR(200)  NOT NULL,
  module_hours        TINYINT UNSIGNED NOT NULL COMMENT 'Contact hours for this module',
  assigned_teacher_id INT UNSIGNED  DEFAULT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_subject_module       (subject_id, module_number),
  INDEX      idx_module_teacher      (assigned_teacher_id),

  CONSTRAINT fk_module_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_module_teacher
    FOREIGN KEY (assigned_teacher_id) REFERENCES teachers (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='Individual modules (units/chapters) within a subject';


-- ============================================================
-- 4. master_grid
--    Stores the final generated timetable.
--    Populated by the Phase 2 scheduling algorithm.
--    Each row represents one time-slot entry in the grid.
-- ============================================================
CREATE TABLE IF NOT EXISTS master_grid (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  day        ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
  time_slot  VARCHAR(20)   NOT NULL COMMENT 'Format: HH:MM–HH:MM, e.g. 09:00–10:00',
  subject_id INT UNSIGNED  DEFAULT NULL,
  teacher_id INT UNSIGNED  DEFAULT NULL,
  module_id  INT UNSIGNED  DEFAULT NULL,
  year       VARCHAR(10)   NOT NULL COMMENT 'FY / SY / TY',
  department VARCHAR(100)  NOT NULL,
  room       VARCHAR(50)   DEFAULT NULL,

  PRIMARY KEY (id),
  INDEX idx_grid_day_slot  (day, time_slot),
  INDEX idx_grid_year_dept (year, department),
  INDEX idx_grid_teacher   (teacher_id),
  INDEX idx_grid_subject   (subject_id),

  CONSTRAINT fk_grid_subject
    FOREIGN KEY (subject_id) REFERENCES subjects       (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_grid_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers       (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_grid_module
    FOREIGN KEY (module_id)  REFERENCES subject_modules(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='Final generated timetable — populated in Phase 2';


-- ============================================================
-- 5. upload_sessions
--    Audit log for every CSV file upload attempt.
--    error_report stores a JSON array of module-audit errors.
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_sessions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uploaded_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filename     VARCHAR(255) NOT NULL,
  status       ENUM('pending','validated','failed') NOT NULL DEFAULT 'pending',
  error_report JSON         DEFAULT NULL COMMENT 'Array of ModuleAuditError objects; NULL when validated',

  PRIMARY KEY (id),
  INDEX idx_upload_status (status),
  INDEX idx_upload_time   (uploaded_at)
) ENGINE=InnoDB
  COMMENT='Audit log for each CSV file upload attempt';
