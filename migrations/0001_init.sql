-- Schema for KYPZERO. Events keep their fields as JSON so new fields need no migration.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE registrations (
  id TEXT PRIMARY KEY,
  ticket TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  college TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, email)
);
CREATE INDEX idx_registrations_event ON registrations (event_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Starter events
INSERT INTO events (id, data, created_at) VALUES ('nightmare-exe', '{"title":"NIGHTMARE.EXE","tagline":"24 hours. No sleep. Something is watching your commits.","description":"Our flagship overnight hackathon, held on Halloween night.\n\nBuild anything: web, AI, hardware, games. The only rule is that it must be finished before sunrise. Mentors will walk the halls all night. Some of them are real.\n\nFood, energy drinks, swag and a prize pool for the teams that survive.","date":"2026-10-31T18:00","deadline":"2026-10-28","venue":"Main Auditorium, Block Z","mode":"offline","prize":"₹1,00,000 pool","teamSize":"2-4 hackers","seats":150,"status":"open","tags":["24h","open theme","overnight"]}', '2026-09-01T00:00:00.000Z');
INSERT INTO events (id, data, created_at) VALUES ('haunted-kernel', '{"title":"THE HAUNTED KERNEL","tagline":"A capture-the-flag night on Friday the 13th.","description":"Jeopardy-style CTF: web, crypto, forensics, reverse engineering and pwn.\n\nThe flags are hidden in a machine that was last booted in 1999. Break in before it wakes up.","date":"2026-11-13T21:00","deadline":"2026-11-11","venue":"Online, Discord + CTFd","mode":"online","prize":"₹40,000 + swag","teamSize":"1-3 hackers","seats":300,"status":"open","tags":["CTF","security","online"]}', '2026-09-01T00:00:00.000Z');
INSERT INTO events (id, data, created_at) VALUES ('seance-of-code', '{"title":"SÉANCE OF CODE","tagline":"Summon an AI that should not exist.","description":"A 36-hour AI buildathon. Build agents, generative art, voice spirits and anything else that talks back.\n\nWorkshops on LLMs, RAG and agents on day one.","date":"2026-12-12T10:00","deadline":"2026-12-05","venue":"Innovation Lab, Floor 13","mode":"hybrid","prize":"₹75,000 pool","teamSize":"2-4 hackers","seats":120,"status":"open","tags":["AI","36h","workshops"]}', '2026-09-01T00:00:00.000Z');
