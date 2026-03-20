import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { User } from "./User";
import { Schedule } from "./Schedule";
import { EventType } from "./EventType";

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  userId!: number;

  @Column({ nullable: true })
  scheduleId!: number;

  @Column({ nullable: true })
  typeId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (u) => u.events)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Schedule, (s) => s.events)
  @JoinColumn({ name: "scheduleId" })
  schedule!: Schedule;

  @ManyToOne(() => EventType, (et) => et.events)
  @JoinColumn({ name: "typeId" })
  eventType!: EventType;

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("eve");
  }
}
