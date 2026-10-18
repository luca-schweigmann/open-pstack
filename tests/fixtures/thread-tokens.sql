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

ALTER TABLE threads ADD COLUMN title TEXT;
ALTER TABLE threads ADD COLUMN source TEXT;
ALTER TABLE threads ADD COLUMN first_user_message TEXT;
UPDATE threads SET title = name;

INSERT INTO threads (id, title, source, first_user_message, tokens_used, created_at_ms, git_origin_url, cwd) VALUES
('native-root', 'build', NULL, NULL, 0, 3000, 'repo-native', '/native'),
('native-owner', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/pr218_gate_owner"}}}', 'PR #99 verifier ignored', 300, 3000, 'repo-native', '/native'),
('native-verifier', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/pr218_verifier"}}}', '', 10, 3000, 'repo-native', '/native'),
('native-title', 'PR #218 owner title wins', '{"subagent":{"thread_spawn":{"agent_path":"/root/pr99_verifier"}}}', 'PR #98 verifier ignored', 300, 3000, 'repo-native', '/native'),
('native-message', '', '{invalid-json', 'PR #218 fix message fallback', 5, 3000, 'repo-native', '/native'),
('native-helper', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/pickup_authority/"}}}', '', 5, 3000, 'repo-native', '/native'),
('native-unnamed', '', '"cli"', '', 0, 3000, 'repo-native', '/native'),
('foreign-root', 'other build', NULL, NULL, 0, 3000, 'repo-native', '/native'),
('foreign-a', 'PR #34 verifier one', NULL, NULL, 10, 3000, 'repo-native', '/native'),
('foreign-b', 'PR #34 verifier two', NULL, NULL, 10, 3000, 'repo-native', '/native'),
('foreign-c', 'PR #34 verifier three', NULL, NULL, 10, 3000, 'repo-native', '/native');
INSERT INTO thread_spawn_edges VALUES
('native-root', 'native-owner', 'completed'),
('native-owner', 'native-verifier', 'completed'),
('native-root', 'native-title', 'completed'),
('native-root', 'native-message', 'completed'),
('native-root', 'native-helper', 'completed'),
('native-root', 'native-unnamed', 'completed'),
('foreign-root', 'foreign-a', 'completed'),
('foreign-root', 'foreign-b', 'completed'),
('foreign-root', 'foreign-c', 'completed');

INSERT INTO threads (id, title, source, tokens_used, created_at_ms, git_origin_url, cwd) VALUES
('prepr-owner', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/b2u_owner"}}}', 300, 4000, 'repo-native', '/native'),
('prepr-verifier', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/pr226_verifier"}}}', 10, 4000, 'repo-native', '/native'),
('foreign-prepr-owner', '', '{"subagent":{"thread_spawn":{"agent_path":"/root/b2u_owner"}}}', 9000, 4000, 'repo-native', '/native');
INSERT INTO thread_spawn_edges VALUES
('native-root', 'prepr-owner', 'completed'),
('native-root', 'prepr-verifier', 'completed'),
('foreign-root', 'foreign-prepr-owner', 'completed');
