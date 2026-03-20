import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, OneToMany } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { Event } from "./Event";

@Entity("event_types")
export class EventType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  type!: string; // Morning Check-in | End of Day Check-in | Weekly Check-in

  @Column({ nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Event, (e) => e.eventType)
  events?: Event[];

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("evt");
  }
}
