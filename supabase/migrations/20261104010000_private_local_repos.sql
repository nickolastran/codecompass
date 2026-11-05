-- Uploaded zips are private code: only the backend (secret key) reads them
update storage.buckets set public = false where id = 'local_repos';
