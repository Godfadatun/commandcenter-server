import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, BeforeInsert } from "typeorm";
import { generateCode } from "../utils/generateCode";
import { User } from "./User";

@Entity("notion_configs")
export class NotionConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  userId!: number;

  @Column({ nullable: true })
  workspaceUrl!: string;

  @Column({ nullable: true })
  notionToken!: string;

  @Column({ nullable: true })
  tasksDbId!: string;

  @Column({ nullable: true })
  dailySummaryDbId!: string;

  @Column({ nullable: true })
  expenseDebtDbId!: string;

  @Column({ nullable: true })
  weeklyExpenseDbId!: string;

  @Column({ default: "ACTIVE" })
  status!: string; // ACTIVE | INACTIVE | DELETED

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => User, (u) => u.notionConfig)
  @JoinColumn({ name: "userId" })
  user!: User;

  @BeforeInsert()
  generateCode() {
    if (!this.code) this.code = generateCode("nti");
  }
}
