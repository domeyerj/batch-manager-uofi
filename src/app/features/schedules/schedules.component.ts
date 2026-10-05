import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SailpointPluginService, TaskManagerService } from '@core';
import { TranslatePipe } from '@ngx-translate/core';
import { type Source, type Schedule3 } from '@sailpoint/angular-sdk/sources';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ScheduleCalendarComponent } from './calendar/schedule-calendar.component';
import { ScheduleForecastService } from './calendar/schedule-forecast.service';
import { type CronDescription, nextQuartzRun, parseQuartzCron } from './calendar/cron-engine';
import { describeCron } from './calendar/forecast-events';

type SchedulesView = 'list' | 'calendar';
const VIEW_STORAGE_KEY = 'batch-manager-uofi.schedules.view';

function readStoredView(): SchedulesView {
  try {
    return globalThis.localStorage?.getItem(VIEW_STORAGE_KEY) === 'calendar' ? 'calendar' : 'list';
  } catch {
    return 'list';
  }
}

interface SourceScheduleDisplay {
  type: string;
  cronExpression: string;
  humanReadable: string;
  description: CronDescription;
  /** Next fire time in the selected schedule time zone (null if none / unparsable). */
  nextRun: Date | null;
}

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    SelectModule,
    TagModule,
    ButtonModule,
    TranslatePipe,
    ScheduleCalendarComponent,
  ],
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
})
export class SchedulesComponent {
  protected readonly taskManager = inject(TaskManagerService);
  private readonly plugin = inject(SailpointPluginService);
  private readonly forecast = inject(ScheduleForecastService);

  protected readonly view = signal<SchedulesView>(readStoredView());
  private searchesRequested = false;

  constructor() {
    // The scheduled-search table was never populated; load it once the handshake is ready.
    effect(() => {
      if (this.plugin.apiReady() && !this.searchesRequested) {
        this.searchesRequested = true;
        void this.taskManager.loadScheduledSearches();
      }
    });
  }

  protected setView(view: SchedulesView): void {
    this.view.set(view);
    try {
      globalThis.localStorage?.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* storage unavailable in some sandboxed iframes */
    }
  }

  protected readonly selectedSource = signal<Source | null>(null);
  protected readonly sourceSchedules = signal<SourceScheduleDisplay[]>([]);
  protected readonly isLoadingSchedules = signal<boolean>(false);

  protected async onSourceChange(src: Source | null): Promise<void> {
    if (!src?.id) {
      this.sourceSchedules.set([]);
      return;
    }

    this.isLoadingSchedules.set(true);
    try {
      const schedules = await this.taskManager.loadSourceSchedules(src.id);
      this.sourceSchedules.set(
        schedules.map((s: Schedule3) => ({
          type: s.type,
          cronExpression: s.cronExpression,
          humanReadable: this.parseCronToHuman(s.cronExpression),
          description: describeCron(s.cronExpression),
          nextRun: this.nextRun(s.cronExpression),
        }))
      );
    } finally {
      this.isLoadingSchedules.set(false);
    }
  }

  private nextRun(expression: string): Date | null {
    try {
      return nextQuartzRun(parseQuartzCron(expression), new Date(), this.forecast.timeZone());
    } catch {
      return null;
    }
  }

  protected parseCronToHuman(cron: string): string {
    if (!cron) return 'Not scheduled';
    const parts = cron.trim().split(/\s+/);
    if (parts.length >= 6) {
      // Quartz: sec min hour day-of-month month day-of-week
      const [, min, hour, dom, , dow] = parts;
      if (dom === '?' || dom === '*') {
        if (dow === '*' || dow === '?') {
          return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
        }
        return `Weekly on day ${dow} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
      }
    }
    return `Cron: ${cron}`;
  }
}
