-- Speaker headshots, named firstname_lastname.png. Public so the app can load
-- them by URL. With no write policies, uploads go through the Supabase dashboard.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speakerPhotos', 'speakerPhotos', true, 5242880, array['image/png'])
on conflict (id) do nothing;
