CREATE TABLE threads (name TEXT, tokens_used INTEGER, created_at_ms INTEGER, rollout_path TEXT, git_origin_url TEXT, cwd TEXT);
INSERT INTO threads VALUES
('PR #12 owner build', 9999, 500, 'owner.jsonl', 'repo-a', '/sample/a'),
('PR #12 verifier flow', 10, 1100, NULL, 'repo-a', '/sample/a'),
('PR #12 fix findings', 5, 1200, NULL, 'repo-a', '/sample/a'),
('PR #12 verifier diff', 10, 1300, NULL, 'repo-a', '/sample/a'),
('PR #12 verifier extra', 10, 1400, NULL, 'repo-a', '/sample/a'),
('PR #12 owner build', 1000, 1000, NULL, 'repo-b', '/sample/b'),
('PR #13 verifier flow', 40, 1450, NULL, 'repo-a', '/sample/a'),
('slice:sample owner build', 0, 1500, NULL, NULL, '/sample/a'),
('unassigned', 70, 1600, NULL, 'repo-a', '/sample/a'),
('PR #12 merge helper', 20, 1700, NULL, 'repo-a', '/sample/a'),
(NULL, NULL, 1800, NULL, 'repo-a', '/sample/a'),
('PR #99 verifier old', 100, 100, NULL, 'repo-a', '/sample/a'),
('PR #99 verifier future', 100, 2100, NULL, 'repo-a', '/sample/a');

ALTER TABLE threads ADD COLUMN id TEXT;
UPDATE threads SET id = CAST(rowid AS TEXT);
CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT, status TEXT);
INSERT INTO threads VALUES ('build chat', 30, 1000, NULL, 'repo-a', '/sample/a', 'root');
INSERT INTO thread_spawn_edges VALUES
('root', '1', 'completed'), ('root', '2', 'completed'),
('root', '3', 'completed'), ('root', '4', 'completed'), ('root', '5', 'completed'),
('root', '10', 'completed');
