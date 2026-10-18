CREATE TABLE threads (name TEXT, tokens_used INTEGER, created_at_ms INTEGER);
INSERT INTO threads VALUES
('PR #12 owner build', 900, 1000),
('PR #12 verifier flow', 100, 1100),
('PR #12 fix findings', 50, 1200),
('PR #12 owner follow-up', 100, 1300),
('PR #13 verifier flow', 40, 1400),
('slice:sample owner build', 0, 1500),
('unassigned', 70, 1600),
('PR #12 merge helper', 20, 1700),
(NULL, NULL, 1800);
