import type { DomainEvent } from "@lavimd/shared";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InMemoryEventBus } from "../common/events/event-bus";
import { LedgerService } from "./ledger.service";

interface CommissionEventPayload {
  commissionId: string;
  partnerId: string;
  amountMinor: number;
  currency: string;
  reversed?: boolean;
}

/**
 * Reacts to commission events by writing ledger entries.
 *
 * The commissions service never calls the ledger directly — it publishes, and
 * this subscriber reacts. That keeps the financial ledger decoupled from the
 * approval workflow and makes future subscribers (notifications, reporting)
 * additive.
 */
@Injectable()
export class LedgerSubscriber implements OnModuleInit {
  private readonly logger = new Logger(LedgerSubscriber.name);

  constructor(
    private readonly events: InMemoryEventBus,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe("commission.approved", (event) => this.onCommissionApproved(event));
    this.events.subscribe("commission.paid", (event) => this.onCommissionSettled(event));
  }

  private async onCommissionApproved(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as CommissionEventPayload;
    await this.ledger.append({
      type: "commission_accrued",
      partnerId: payload.partnerId,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      referenceId: payload.commissionId,
      occurredAt: new Date(event.occurredAt),
    });
    this.logger.log(`Accrued commission ${payload.commissionId} to partner ${payload.partnerId}`);
  }

  private async onCommissionSettled(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as CommissionEventPayload;
    if (payload.reversed !== true) return;
    await this.ledger.append({
      type: "commission_reversed",
      partnerId: payload.partnerId,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      referenceId: payload.commissionId,
      occurredAt: new Date(event.occurredAt),
    });
  }
}
