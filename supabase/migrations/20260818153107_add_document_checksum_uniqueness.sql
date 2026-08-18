alter table public.hrx_documents
  add column if not exists checksum_sha256 text;

create unique index if not exists hrx_documents_checksum_unique_idx
  on public.hrx_documents(checksum_sha256)
  where checksum_sha256 is not null;
