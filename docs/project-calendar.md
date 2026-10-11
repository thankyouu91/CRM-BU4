# Project activity calendar

The Projects page now uses compact timeline rows instead of large cards. Month view shows days (including weekend shading); quarter view shows three months; year view shows twelve months. The current business day has a marker. On phones, the same selected period renders as a readable agenda rather than a horizontally compressed timeline.

Navigation includes previous/next period, Today, a month picker, project-name search and every existing project status. `?calendar=quarter&month=2026-10` restores the view and anchor on refresh or sharing. A nearest-period action is offered when matching scheduled projects exist outside an empty period. Existing project detail links, create permissions and the project creation form remain available.

Scheduling rules:

- With both dates, a project is shown in every intersecting period, clipped at period boundaries. Its due day is included in full.
- With only a due date, the calendar shows a deadline flag, not an invented duration.
- With only a start date, the range is open-ended and uses a dashed border until a due date is supplied.
- Missing dates, invalid dates and reversed ranges are kept in the separate “Chưa xếp lịch” section. Creation timestamps are never substituted for planned dates.
- Period boundaries and visible date labels use the application's business timezone. Progress and project status remain separate existing business values.

This is a read-only scheduling view: opening a project leads to the existing editor. It does not move dates by dragging or change existing project data. No schema migration, dependency or new data endpoint is required. Secondary project form code is loaded on first use. The calendar background is one shared grid, not repeated date cells for each project.

Tests cover leap years, business-zone boundaries, period navigation, cross-period clipping, partial dates, URL selection, month/quarter/year switching, search/status filters and viewer permissions. Visual checks use the real components with clearly separate local fixture data at desktop and 390px mobile widths; no production data is edited during those checks.
