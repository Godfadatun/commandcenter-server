import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, OneToMany } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { User } from "./User";
import { Event } from "./Event";

@Entity("schedules")
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  userId!: number;

  @Column({ default: "daily" })
  frequency!: string; // daily | weekly | monthly | quarterly | semiannually | annually

  @Column({ type: "time", nullable: true })
  time!: string; // 24hrs format

  @Column({ nullable: true })
  cronFormat!: string; // cron expression

  @Column({ default: true })
  enabled!: boolean;

  @Column({ nullable: true })
  lastRanAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (u) => u.schedules)
  @JoinColumn({ name: "userId" })
  user!: User;

  @OneToMany(() => Event, (e) => e.schedule)
  events?: Event[];

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("sch");
  }
}
