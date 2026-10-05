import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskManagerService } from '@core';
import { type TaskStatus } from '@sailpoint/angular-sdk/task_management';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';

interface StatusFilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-tasks-monitor',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    TableModule,
    ProgressBarModule,
    TagModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TooltipModule,
    MessageModule,
  ],
  templateUrl: './tasks-monitor.component.html',
  styleUrl: './tasks-monitor.component.scss',
})
export class TasksMonitorComponent {
  protected readonly taskManager = inject(TaskManagerService);

  // Selected task for inspection dialog
  protected readonly selectedTask = signal<TaskStatus | null>(null);
  protected readonly detailsDialogVisible = signal(false);

  // Action status message
  protected readonly actionMessage = signal<{ severity: 'success' | 'info' | 'warn' | 'error'; text: string } | null>(null);
  protected readonly terminatingTaskId = signal<string | null>(null);

  // Filter state
  protected readonly selectedStatusFilter = signal<string>('ALL');

  protected readonly statusFilterOptions: StatusFilterOption[] = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Success', value: 'SUCCESS' },
    { label: 'Warning', value: 'WARNING' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Terminated', value: 'TERMINATED' },
    { label: 'Temporary Error', value: 'TEMPERROR' },
  ];

  // Filtered recent tasks
  protected readonly filteredRecentTasks = computed(() => {
    const filter = this.selectedStatusFilter();
    const tasks = this.taskManager.recentTasks();
    if (filter === 'ALL') {
      return tasks;
    }
    return tasks.filter((t) => t.completionStatus === filter);
  });

  protected getStatusSeverity(status: string | null | undefined): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warn';
      case 'ERROR':
      case 'TEMPERROR':
        return 'danger';
      case 'TERMINATED':
        return 'secondary';
      default:
        return 'info';
    }
  }

  protected async manualRefresh(): Promise<void> {
    await this.taskManager.refreshTasks();
    this.actionMessage.set({ severity: 'info', text: 'Task status refreshed.' });
    setTimeout(() => this.actionMessage.set(null), 3000);
  }

  protected viewTaskDetails(task: TaskStatus): void {
    this.selectedTask.set(task);
    this.detailsDialogVisible.set(true);
  }

  protected async terminateTask(task: TaskStatus): Promise<void> {
    if (!task.id) return;
    this.terminatingTaskId.set(task.id);
    try {
      await this.taskManager.terminateTask(task.id);
      this.actionMessage.set({
        severity: 'success',
        text: `Task "${task.description || task.uniqueName}" terminated and cleared.`,
      });
      setTimeout(() => this.actionMessage.set(null), 5000);
    } catch (err) {
      this.actionMessage.set({
        severity: 'error',
        text: `Failed to terminate task: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      this.terminatingTaskId.set(null);
    }
  }

  protected getObjectKeys(obj: unknown): string[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj as Record<string, unknown>);
  }

  protected getObjectValue(obj: unknown, key: string): unknown {
    if (!obj || typeof obj !== 'object') return '';
    return (obj as Record<string, unknown>)[key];
  }
}
