import { Global, Module } from "@nestjs/common";
import { InMemoryEventBus } from "./event-bus";

@Global()
@Module({
  providers: [InMemoryEventBus],
  exports: [InMemoryEventBus],
})
export class EventsModule {}
