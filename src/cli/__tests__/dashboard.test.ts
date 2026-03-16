import { describe, it, expect } from 'vitest';
import { formatProgressBar, formatDashboard } from '../formatters.js';
import type { DashboardOverview } from '../../core/engine/dashboard.js';
import type { Alert } from '../../core/types.js';

describe('formatProgressBar', () => {
  it('should show 50% with half filled and half empty', () => {
    const result = formatProgressBar(50);
    expect(result).toContain('██████████');
    expect(result).toContain('░░░░░░░░░░');
    expect(result).toContain('50%');
  });

  it('should show 0% with all empty', () => {
    const result = formatProgressBar(0);
    expect(result).toContain('░░░░░░░░░░░░░░░░░░░░');
    expect(result).toContain('0%');
    expect(result).not.toContain('█');
  });

  it('should show 100% with all filled', () => {
    const result = formatProgressBar(100);
    expect(result).toContain('████████████████████');
    expect(result).toContain('100%');
    expect(result).not.toContain('░');
  });
});

describe('formatDashboard', () => {
  it('should display both plan titles, progress bars, and counts for 2 plans', () => {
    const overview: DashboardOverview = {
      plans: [
        {
          id: 'p1',
          title: 'Plan Alpha',
          status: 'active',
          total_tasks: 3,
          done_tasks: 2,
          active_tasks: 1,
          blocked_tasks: 0,
          progress_pct: 66,
        },
        {
          id: 'p2',
          title: 'Plan Beta',
          status: 'active',
          total_tasks: 4,
          done_tasks: 1,
          active_tasks: 0,
          blocked_tasks: 1,
          progress_pct: 25,
        },
      ],
      active_count: 2,
      total_tasks: 7,
      done_tasks: 3,
    };
    const alerts: Alert[] = [];

    const result = formatDashboard(overview, alerts);

    expect(result).toContain('Plan Alpha');
    expect(result).toContain('Plan Beta');
    expect(result).toContain('█');
    expect(result).toContain('░');
    expect(result).toContain('66%');
    expect(result).toContain('25%');
    expect(result).toContain('done 2');
    expect(result).toContain('done 1');
    expect(result).toContain('active 1');
    expect(result).toContain('blocked 0');
    expect(result).toContain('blocked 1');
    expect(result).not.toContain('⚠');
  });

  it('should show "No active plans." when there are no plans', () => {
    const overview: DashboardOverview = {
      plans: [],
      active_count: 0,
      total_tasks: 0,
      done_tasks: 0,
    };
    const alerts: Alert[] = [];

    const result = formatDashboard(overview, alerts);

    expect(result).toContain('No active plans.');
  });

  it('should display alert messages when alerts are present', () => {
    const overview: DashboardOverview = {
      plans: [],
      active_count: 0,
      total_tasks: 0,
      done_tasks: 0,
    };
    const alerts: Alert[] = [
      {
        type: 'stale',
        entity_type: 'task',
        entity_id: 't1',
        message: 'Task "Setup" has been in progress for 4 days',
      },
      {
        type: 'blocked',
        entity_type: 'plan',
        entity_id: 'p1',
        message: 'Plan "Deploy" has blocked tasks',
      },
    ];

    const result = formatDashboard(overview, alerts);

    expect(result).toContain('⚠ Alerts:');
    expect(result).toContain('[stale] Task "Setup" has been in progress for 4 days');
    expect(result).toContain('[blocked] Plan "Deploy" has blocked tasks');
  });
});
