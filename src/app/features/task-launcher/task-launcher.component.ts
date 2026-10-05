import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskManagerService } from '@core';
import { type Source } from '@sailpoint/angular-sdk/sources';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-task-launcher',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    ButtonModule,
    ToggleSwitchModule,
    MessageModule,
    CardModule,
    TooltipModule,
  ],
  templateUrl: './task-launcher.component.html',
  styleUrl: './task-launcher.component.scss',
})
export class TaskLauncherComponent {
  protected readonly taskManager = inject(TaskManagerService);
  private readonly router = inject(Router);

  // Form selections
  protected readonly selectedSource = signal<Source | null>(null);
  protected readonly disableOptimization = signal<boolean>(false);

  // Execution states
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly launchResult = signal<{
    severity: 'success' | 'error';
    summary: string;
    detail: string;
    taskId?: string;
  } | null>(null);

  protected async triggerAccounts(): Promise<void> {
    const src = this.selectedSource();
    if (!src?.id) return;

    this.isSubmitting.set(true);
    this.launchResult.set(null);

    try {
      const res = await this.taskManager.triggerAccountAggregation(
        src.id,
        this.disableOptimization()
      );
      const taskId = res.task?.id || '';
      this.launchResult.set({
        severity: 'success',
        summary: 'Account Aggregation Initiated',
        detail: `Aggregation started for source "${src.name}". Task ID: ${taskId}`,
        taskId,
      });
    } catch (err) {
      this.launchResult.set({
        severity: 'error',
        summary: 'Failed to Launch Aggregation',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async triggerEntitlements(): Promise<void> {
    const src = this.selectedSource();
    if (!src?.id) return;

    this.isSubmitting.set(true);
    this.launchResult.set(null);

    try {
      const res = await this.taskManager.triggerEntitlementAggregation(src.id);
      const taskId = (res as { id?: string }).id || '';
      this.launchResult.set({
        severity: 'success',
        summary: 'Entitlement Aggregation Initiated',
        detail: `Entitlement scan started for source "${src.name}". Task ID: ${taskId}`,
        taskId,
      });
    } catch (err) {
      this.launchResult.set({
        severity: 'error',
        summary: 'Failed to Launch Entitlements',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected navigateToMonitor(): void {
    void this.router.navigate(['/tasks']);
  }
}
