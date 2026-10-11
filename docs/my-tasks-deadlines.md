# Deadline filters in My Tasks

The task list has All, This week, Next week and Next month filters. Weeks run Monday–Sunday; next month means the next calendar month, including year and leap-year transitions. Boundaries use the business timezone (`Asia/Ho_Chi_Minh` by default), shared with work reports.

`GET /api/tasks?deadline=this-week|next-week|next-month` applies inclusive `dueDate` bounds before cursor pagination. Missing or unrecognized filters use `all`. Project visibility, assignment scope, search and status filters still apply. Undated tasks remain accessible in All. Periods are independent: a date can belong to both Next week and Next month when those periods overlap.

The four statistics cover the entire filtered result, not just the loaded page. In a selected period, Completed counts DONE tasks with deadlines in that period, regardless of completion date. All retains the existing Completed in the last 7 days statistic. No additional database queries or client requests are needed to calculate period totals.

Responses include the normalized `deadline` and server `asOf` timestamp, keeping date labels and urgency groups consistent. Switching periods resets pagination and hides the previous period until the response arrives. Search, scope changes, task actions and the context menu remain available.

Tests cover timezone/week/month boundaries, leap years, server-side filtering with pagination and statistics, UI switching/search/loading/empty states, and actual PostgreSQL pagination across more than 100 matching tasks in CI.
