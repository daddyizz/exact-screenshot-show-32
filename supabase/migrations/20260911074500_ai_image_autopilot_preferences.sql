alter table public.blogs
  add column if not exists ai_image_aspect_ratio text not null default '16:9',
  add column if not exists ai_image_style text not null default 'auto',
  add column if not exists ai_image_custom_width integer,
  add column if not exists ai_image_custom_height integer;

alter table public.blogs
  drop constraint if exists blogs_ai_image_aspect_ratio_check,
  add constraint blogs_ai_image_aspect_ratio_check
    check (ai_image_aspect_ratio in ('16:9','4:3','1:1','custom')),
  drop constraint if exists blogs_ai_image_style_check,
  add constraint blogs_ai_image_style_check
    check (ai_image_style in ('auto','realistic','2d','3d')),
  drop constraint if exists blogs_ai_image_custom_width_check,
  add constraint blogs_ai_image_custom_width_check
    check (ai_image_custom_width is null or ai_image_custom_width between 320 and 4096),
  drop constraint if exists blogs_ai_image_custom_height_check,
  add constraint blogs_ai_image_custom_height_check
    check (ai_image_custom_height is null or ai_image_custom_height between 320 and 4096);

notify pgrst, 'reload schema';
