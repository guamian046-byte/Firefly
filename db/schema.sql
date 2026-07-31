CREATE TABLE IF NOT EXISTS users (
	id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	email VARCHAR(254) NOT NULL UNIQUE,
	username VARCHAR(40) NOT NULL UNIQUE,
	display_name VARCHAR(60) NOT NULL DEFAULT '',
	bio VARCHAR(500) NOT NULL DEFAULT '',
	website VARCHAR(255) NOT NULL DEFAULT '',
	password_hash TEXT NOT NULL,
	role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'author', 'moderator', 'admin')),
	active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS sessions (
	token_hash CHAR(64) PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
	id UUID PRIMARY KEY,
	author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title VARCHAR(120) NOT NULL,
	slug VARCHAR(140) UNIQUE,
	excerpt VARCHAR(300) NOT NULL DEFAULT '',
	body TEXT NOT NULL,
	status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
	review_note VARCHAR(300) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS site_settings (
	key VARCHAR(64) PRIMARY KEY,
	value VARCHAR(255) NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (key, value) VALUES
	('registration_enabled', 'true'),
	('publishing_enabled', 'true'),
	('require_review', 'true'),
	('announcement_title', '公告'),
	('announcement_content', '欢迎来到 Guamian 的小站')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS comments (
	id UUID PRIMARY KEY,
	page_path VARCHAR(255) NOT NULL,
	author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	content VARCHAR(2000) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_albums (
	id UUID PRIMARY KEY,
	slug VARCHAR(80) NOT NULL UNIQUE,
	name VARCHAR(100) NOT NULL,
	description VARCHAR(500) NOT NULL DEFAULT '',
	location VARCHAR(120) NOT NULL DEFAULT '',
	album_date DATE,
	tags VARCHAR(500) NOT NULL DEFAULT '',
	created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_photos (
	id UUID PRIMARY KEY,
	album_id UUID NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
	uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
	file_name VARCHAR(255) NOT NULL,
	content_type VARCHAR(80) NOT NULL,
	file_size BIGINT NOT NULL,
	caption VARCHAR(300) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS posts_author_idx ON community_posts (author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS posts_status_idx ON community_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS comments_page_idx ON comments (page_path, created_at DESC);
CREATE INDEX IF NOT EXISTS gallery_photos_album_idx ON gallery_photos (album_id, created_at DESC);
