import { z } from "zod";
const id=z.string().min(1).max(100).regex(/^[A-Za-z0-9:_-]+$/);
const text=z.string().trim().min(1).max(250);
const note=z.string().trim().max(1000).default("");
const amount=z.union([z.string(),z.number()]).transform(String);
const nullableId=z.union([id,z.literal("")]).optional();
const learner={ fullName:text,phone:z.string().trim().max(80).default(""),groupName:text,staffId:id,monthlyFee:amount,dueDay:z.coerce.number().int().min(1).max(28),status:z.enum(["ACTIVE","PAUSED","LEFT"]),note,platformStudentId:nullableId,rosterStudentId:nullableId,sourceKey:nullableId };
export const financeCommand=z.discriminatedUnion("action",[
 z.object({action:z.literal("IMPORT_LEARNERS"),items:z.array(z.object(learner).strict()).min(1).max(200)}).strict(),
 z.object({action:z.literal("OPEN_PERIOD"),month:z.string(),opening:z.object({CASH:amount,CARD:amount,TERMINAL:amount,TRANSFER:amount})}).strict(),
 z.object({action:z.literal("ADD_STAFF"),fullName:text,sharePercent:z.string(),platformTeacherId:nullableId}).strict(),
 z.object({action:z.literal("UPDATE_STAFF"),id,sharePercent:z.string(),active:z.boolean()}).strict(),
 z.object({action:z.literal("ADD_LEARNER"),...learner}).strict(),
 z.object({action:z.literal("UPDATE_LEARNER"),id,...learner}).strict(),
 z.object({action:z.literal("BILL_LEARNERS"),month:z.string(),learnerIds:z.array(id).min(1).max(200),amount:amount.optional()}).strict(),
 z.object({action:z.literal("POST_ENTRY"),month:z.string(),kind:z.enum(["TUITION","OTHER_INCOME","EXPENSE","ADVANCE","SALARY","REFUND"]),amount,channel:z.enum(["CASH","CARD","TERMINAL","TRANSFER"]),date:z.string(),description:text,invoiceId:nullableId,staffId:nullableId,refundOfId:nullableId,category:z.enum(["RENT","UTILITIES","BOOKS","SUPPLIES","OTHER"]).optional()}).strict(),
 z.object({action:z.literal("REVERSE_ENTRY"),month:z.string(),id,reason:text}).strict(),
 z.object({action:z.literal("ACCRUAL"),month:z.string(),staffId:id,amount,reason:text}).strict(),
 z.object({action:z.literal("CLOSE_PERIOD"),month:z.string(),confirmation:z.literal("YOPISH")}).strict(),
 z.object({action:z.literal("ADD_LEAD"),fullName:text,phone:z.string().trim().min(3).max(80),groupName:z.string().trim().max(250).default(""),appointmentDate:z.string().default(""),note}).strict(),
 z.object({action:z.literal("UPDATE_LEAD"),id,status:z.enum(["NEW","SCHEDULED","TRIAL","ENROLLED","LOST"]),note}).strict(),
]);
export type FinanceCommand=z.infer<typeof financeCommand>;
