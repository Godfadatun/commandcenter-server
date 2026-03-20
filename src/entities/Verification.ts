import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { User } from "./User";

@Entity("verifications")
export class Verification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  userId!: number;

  @Column()
  event!: string; // VERIFY_EMAIL | FORGOT_PASSWORD | RESET_PASSWORD

  @Column({ default: "INACTIVE" })
  status!: string; // ACTIVE | INACTIVE | DELETED

  @Column({ default: "UNVERIFIED" })
  verificationStatus!: string; // VERIFIED | UNVERIFIED

  @Column({ nullable: true })
  token!: string; // OTP or token

  @Column({ nullable: true })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("vef");
  }
}
