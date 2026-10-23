-- ==============================================================================
-- Supabase (PostgreSQL) Schema for db_gdgevents
-- Exact 1-to-1 match with original MariaDB/MySQL database structure & seed data
-- Copy and paste this directly into the Supabase SQL Editor.
-- ==============================================================================

-- 1. Table structure for table "admins"
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dumping data for table "admins"
INSERT INTO admins (id, username, password_hash, "createdAt") VALUES
(1, 'admin', '$2y$10$dummyHashForAdminAccount', '2026-10-22 21:55:15'),
(2, 'eventmanager', '$2y$10$dummyHashForEventManager', '2026-10-22 21:55:15'),
(3, 'superadmin', '$2y$10$dummyHashForSuperAdmin', '2026-10-22 21:55:15')
ON CONFLICT (id) DO NOTHING;

-- 2. Table structure for table "attendees"
CREATE TABLE IF NOT EXISTS attendees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  twitter VARCHAR(255) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL,
  role VARCHAR(255) DEFAULT NULL,
  qr_code_token VARCHAR(255) DEFAULT NULL,
  "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP
);

-- Dumping data for table "attendees"
INSERT INTO attendees (id, first_name, last_name, email, twitter, company, role, qr_code_token, "createdAt") VALUES
(1, 'Juan', 'Dela Cruz', 'juan@example.com', '@juandelacruz', 'ABC Technologies', 'Developer', 'QR-JUAN-001', '2026-10-22 21:54:52.000'),
(2, 'Maria', 'Santos', 'maria@example.com', '@mariasantos', 'XYZ Solutions', 'Student', 'QR-MARIA-002', '2026-10-22 21:54:52.000'),
(3, 'Pedro', 'Reyes', 'pedro@example.com', '@pedroreyes', 'CodeWorks', 'Designer', 'QR-PEDRO-003', '2026-10-22 21:54:52.000'),
(4, 'Ana', 'Garcia', 'ana@example.com', '@anagarcia', 'Digital Labs', 'IT Student', 'QR-ANA-004', '2026-10-22 21:54:52.000'),
(5, 'Carlo', 'Mendoza', 'carlo@example.com', '@carlomendoza', 'NextGen Systems', 'Software Engineer', 'QR-CARLO-005', '2026-10-22 21:54:52.000')
ON CONFLICT (id) DO NOTHING;

-- 3. Table structure for table "booths"
CREATE TABLE IF NOT EXISTS booths (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  "sponsorName" VARCHAR(100) DEFAULT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dumping data for table "booths"
INSERT INTO booths (id, name, location, description, "sponsorName", "createdAt") VALUES
('BOOTH001', 'Tech Innovation', 'Ground Floor', 'Showcase of innovative technology', 'Tech Solutions Inc.', '2026-10-22 21:54:52'),
('BOOTH002', 'Game Zone', 'Second Floor', 'Gaming demos and interactive activities', 'Pixel Studios', '2026-10-22 21:54:52'),
('BOOTH003', 'Career Hub', 'Ground Floor', 'Career opportunities and networking', 'Future Careers Corp.', '2026-10-22 21:54:52')
ON CONFLICT (id) DO NOTHING;

-- 4. Table structure for table "booth_users"
CREATE TABLE IF NOT EXISTS booth_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  booth_id VARCHAR(64) NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_booth_id UNIQUE (booth_id)
);

-- Dumping data for table "booth_users"
INSERT INTO booth_users (id, username, password_hash, booth_id, "createdAt") VALUES
(1, 'techbooth', '$2b$10$UPD0cf1kVVI179KqlurgbOxE10uxxVTBnmmjXXCvTHMnMG6tUhSqW', 'BOOTH001', '2026-10-22 21:54:52'),
(2, 'gamebooth', '$2b$10$UPD0cf1kVVI179KqlurgbOxE10uxxVTBnmmjXXCvTHMnMG6tUhSqW', 'BOOTH002', '2026-10-22 21:54:52'),
(3, 'careerbooth', '$2b$10$UPD0cf1kVVI179KqlurgbOxE10uxxVTBnmmjXXCvTHMnMG6tUhSqW', 'BOOTH003', '2026-10-22 21:54:52')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 5. Table structure for table "events"
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  event_date DATE DEFAULT NULL,
  venue VARCHAR(255) DEFAULT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dumping data for table "events"
INSERT INTO events (id, event_name, event_date, venue, "createdAt") VALUES
(1, 'GDG Tech Summit 2026', '2026-11-15', 'University Convention Hall', '2026-10-22 21:54:52'),
(2, 'Developer Workshop', '2026-11-20', 'Computer Laboratory', '2026-10-22 21:54:52'),
(3, 'Innovation Expo', '2026-12-05', 'University Activity Center', '2026-10-22 21:54:52')
ON CONFLICT (id) DO NOTHING;

-- 6. Table structure for table "event_attendees"
CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  attendee_id INT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_number VARCHAR(100) DEFAULT NULL,
  ticket_number VARCHAR(100) NOT NULL UNIQUE,
  ticket_title VARCHAR(255) DEFAULT NULL,
  ticket_venue VARCHAR(255) DEFAULT NULL,
  checkin_status SMALLINT DEFAULT 0,
  checked_in_at TIMESTAMP DEFAULT NULL,
  CONSTRAINT attendee_event UNIQUE (attendee_id, event_id)
);

-- Dumping data for table "event_attendees"
INSERT INTO event_attendees (id, attendee_id, event_id, order_number, ticket_number, ticket_title, ticket_venue, checkin_status, checked_in_at) VALUES
(1, 1, 1, 'ORD-2026-001', 'TKT-2026-001', 'General Admission', 'University Convention Hall', 1, '2026-10-22 21:54:52'),
(2, 2, 1, 'ORD-2026-002', 'TKT-2026-002', 'Student Pass', 'University Convention Hall', 0, NULL),
(3, 3, 1, 'ORD-2026-003', 'TKT-2026-003', 'VIP Pass', 'University Convention Hall', 1, '2026-10-22 21:54:52'),
(4, 4, 2, 'ORD-2026-004', 'TKT-2026-004', 'Workshop Pass', 'Computer Laboratory', 0, NULL),
(5, 5, 3, 'ORD-2026-005', 'TKT-2026-005', 'Expo Pass', 'University Activity Center', 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Table structure for table "scan_logs"
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scan_category_enum') THEN
    CREATE TYPE scan_category_enum AS ENUM ('1-10', '11-50', '51-90', '91+');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scan_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  "attendeeId" INT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  "boothId" VARCHAR(64) NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
  "eventId" INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
  points INT DEFAULT 100,
  category scan_category_enum DEFAULT '1-10',
  CONSTRAINT "UNIQUE_ATTENDEE_BOOTH_EVENT" UNIQUE ("attendeeId", "boothId", "eventId")
);
