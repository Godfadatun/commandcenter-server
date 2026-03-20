import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, BeforeInsert } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { NotionConfig } from "./NotionConfig";
import { Calendar } from "./Calendar";
import { Schedule } from "./Schedule";
import { Event } from "./Event";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ default: "INACTIVE" })
  status!: string; // ACTIVE | INACTIVE | DELETED

  @Column({ default: "UNVERIFIED" })
  verificationStatus!: string; // VERIFIED | UNVERIFIED

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => NotionConfig, (nc) => nc.user)
  notionConfig?: NotionConfig;

  @OneToOne(() => Calendar, (c) => c.user)
  calendar?: Calendar;

  @OneToMany(() => Schedule, (s) => s.user)
  schedules?: Schedule[];

  @OneToMany(() => Event, (e) => e.user)
  events?: Event[];

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("act");
  }
}
