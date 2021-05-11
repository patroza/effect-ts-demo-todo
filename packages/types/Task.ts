import { makeUuid } from "@effect-ts-demo/core/ext/Model"
import * as S from "@effect-ts-demo/core/ext/Schema"
import { pipe } from "@effect-ts/core"
import * as A from "@effect-ts/core/Collections/Immutable/Array"
import * as O from "@effect-ts/core/Option"
import { Option } from "@effect-ts/core/Option"
import * as Lens from "@effect-ts/monocle/Lens"
import { constant } from "@effect-ts/system/Function"

export const UserId = S.positiveInt
export type UserId = S.ParsedShapeOf<typeof UserId>

export const TaskId = S.UUID
export type TaskId = S.ParsedShapeOf<typeof TaskId>

export const TaskListIdLiteral = S.literal("inbox")
export const TaskListId = S.UUID
export type TaskListId = S.ParsedShapeOf<typeof TaskListId>

export const TaskListIdU = S.union(TaskListId, TaskListIdLiteral)
export type TaskListIdU = S.ParsedShapeOf<typeof TaskListIdU>

@S.namedC
export class Step extends S.Model<Step>()(
  pipe(S.required({ title: S.nonEmptyString, completed: S.bool }), (s) =>
    S.withDefaultConstructorFields(s)({ completed: constant(false) })
  )
) {
  static complete = Lens.id<Step>()["|>"](Lens.prop("completed")).set(true)
}

export const EditableTaskProps = {
  title: S.nonEmptyString,
  completed: S.nullable(S.date),
  isFavorite: S.bool, // TODO: Add bool

  due: S.nullable(S.date),
  reminder: S.nullable(S.date),
  note: S.nullable(S.nonEmptyString),
  steps: S.array(Step.Model),
  assignedTo: S.nullable(UserId),
}

export const EditablePersonalTaskProps = {
  myDay: S.nullable(S.date),
}

export class Task extends S.Model<Task>()(
  pipe(
    S.required({
      id: TaskId,
      createdAt: S.date,
      updatedAt: S.date,
      createdBy: UserId,
      listId: TaskListIdU,
      ...EditableTaskProps,
    }),
    (s) =>
      S.withDefaultConstructorFields(s)({
        id: makeUuid,
        isFavorite: constant(false),
        steps: S.constArray,
        listId: constant("inbox"),
        createdAt: () => new Date(),
        updatedAt: () => new Date(),
        completed: constant(O.none),
        due: constant(O.none),
        reminder: constant(O.none),
        note: constant(O.none),
        assignedTo: constant(O.none),
      })
  )
) {
  static complete = Lens.id<Task>()
    ["|>"](Lens.prop("completed"))
    .set(O.some(new Date()))
}

@S.namedC
export class Membership extends S.Model<Membership>()(
  pipe(S.struct({ required: { id: UserId, name: S.nonEmptyString } }))
) {}

export const EditableTaskListProps = {
  title: S.nonEmptyString,
}

@S.namedC
export class TaskList extends S.Model<TaskList>()(
  pipe(
    S.struct({
      required: {
        id: TaskListId,
        ...EditableTaskListProps,
        order: S.array(TaskId),

        members: S.array(Membership.Model),
        ownerId: UserId,
        // tasks: F.array(TaskOrVirtualTask(F))
      },
    }),
    S.tag("TaskList"),
    (s) =>
      S.withDefaultConstructorFields(s)({
        id: makeUuid,
        order: S.constArray,
        members: S.constArray,
      })
  )
) {}

export const EditableTaskListGroupProps = {
  title: S.nonEmptyString,
  lists: S.array(TaskListId),
}

@S.namedC
export class TaskListGroup extends S.Model<TaskListGroup>()(
  pipe(
    S.struct({
      required: {
        id: TaskListId,
        ...EditableTaskListGroupProps,

        ownerId: UserId,
      },
    }),
    S.tag("TaskListGroup"),
    (s) => S.withDefaultConstructorFields(s)({ id: makeUuid, lists: S.constArray })
  )
) {}

export const TaskListOrGroup = S.tagged(TaskList.Model, TaskListGroup.Model)
export type TaskListOrGroup = S.ParsedShapeOf<typeof TaskListOrGroup>

const MyDay = S.struct({ required: { id: TaskId, date: S.date } })
type MyDay = S.ParsedShapeOf<typeof MyDay>

@S.namedC
export class User extends S.Model<User>()(
  pipe(
    S.required({
      id: UserId,
      name: S.nonEmptyString,
      inboxOrder: S.array(TaskId),
      myDay: S.array(MyDay) /* position */,
    }),
    (s) =>
      S.withDefaultConstructorFields(s)({
        inboxOrder: S.constArray,
        myDay: S.constArray,
      })
  )
) {
  static readonly createTask =
    (a: Omit<S.ConstructorInputOf<typeof Task["Model"]>, "createdBy">) => (u: User) =>
      new Task({ ...a, createdBy: u.id })
  static readonly createTask_ =
    (u: User) => (a: Omit<S.ConstructorInputOf<typeof Task["Model"]>, "createdBy">) =>
      new Task({ ...a, createdBy: u.id })

  static readonly createTaskList =
    (a: Omit<S.ConstructorInputOf<typeof TaskList["Model"]>, "ownerId">) => (u: User) =>
      new TaskList({ ...a, ownerId: u.id })
  static readonly createTaskList_ =
    (u: User) => (a: Omit<S.ConstructorInputOf<typeof TaskList["Model"]>, "ownerId">) =>
      new TaskList({ ...a, ownerId: u.id })

  static readonly createTaskListGroup =
    (a: Omit<S.ConstructorInputOf<typeof TaskListGroup["Model"]>, "ownerId">) =>
    (u: User) =>
      new TaskListGroup({ ...a, ownerId: u.id })
  static readonly createTaskListGroup_ =
    (u: User) =>
    (a: Omit<S.ConstructorInputOf<typeof TaskListGroup["Model"]>, "ownerId">) =>
      new TaskListGroup({ ...a, ownerId: u.id })

  static readonly getMyDay = (t: Task) => (u: User) =>
    A.findFirst_(u.myDay, (x) => x.id === t.id)["|>"](O.map((m) => m.date))
  static readonly addToMyDay =
    (t: Task, date: Date) =>
    (u: User): User => ({
      ...u,
      myDay: A.findIndex_(u.myDay, (m) => m.id === t.id)
        ["|>"](O.chain((idx) => A.modifyAt_(u.myDay, idx, (m) => ({ ...m, date }))))
        ["|>"](O.getOrElse(() => A.snoc_(u.myDay, { id: t.id, date }))),
    })
  static readonly removeFromMyDay =
    (t: Task) =>
    (u: User): User => ({
      ...u,
      myDay: u.myDay["|>"](A.filter((m) => m.id !== t.id)),
    })
  static readonly toggleMyDay = (t: Task, myDay: Option<Date>) =>
    O.fold_(
      myDay,
      () => User.removeFromMyDay(t),
      (date) => User.addToMyDay(t, date)
    )
}
