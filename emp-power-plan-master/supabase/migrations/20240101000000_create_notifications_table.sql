-- Create notifications table
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  task_id text references tasks(id) on delete cascade
);

-- Add RLS policies
alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = user_id);

create policy "System can create notifications"
  on notifications for insert
  with check (true); 