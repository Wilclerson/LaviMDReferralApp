import { Module } from "@nestjs/common";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";
import { LedgerSubscriber } from "./ledger.subscriber";

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, LedgerSubscriber],
  exports: [LedgerService],
})
export class LedgerModule {}
