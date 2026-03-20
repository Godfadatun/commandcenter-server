import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, BeforeInsert } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { User } from "./User";

@Entity("calendars")
export class Calendar {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  userId!: number;

  @Column({ nullable: true })
  apiKey!: string;

  @Column({ default: "primary" })
  calendarId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => User, (u) => u.calendar)
  @JoinColumn({ name: "userId" })
  user!: User;

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("cal");
  }
}
