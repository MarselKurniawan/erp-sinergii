-- Allow admins to view all profiles so they can manage users
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));