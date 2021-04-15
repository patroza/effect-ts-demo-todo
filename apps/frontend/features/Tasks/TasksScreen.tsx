import * as T from "@effect-ts-demo/todo-types/ext/Effect"
import * as EO from "@effect-ts-demo/todo-types/ext/EffectOption"
import { NonEmptyString } from "@effect-ts-demo/todo-types/shared"
import * as A from "@effect-ts/core/Collections/Immutable/Array"
import { flow, identity } from "@effect-ts/core/Function"
import * as O from "@effect-ts/core/Option"
import * as ORD from "@effect-ts/core/Ord"
import { UUID } from "@effect-ts/morphic/Algebra/Primitives"
import { Box, Button, IconButton } from "@material-ui/core"
import ArrowDown from "@material-ui/icons/ArrowDownward"
import ArrowUp from "@material-ui/icons/ArrowUpward"
import Refresh from "@material-ui/icons/Refresh"
import { datumEither } from "@nll/datum"
import React, { useCallback } from "react"
import useInterval from "use-interval"

import * as Todo from "@/Todo"
import { Field } from "@/components"
import { useServiceContext } from "@/context"
import { memo, withLoading } from "@/data"
import { toUpperCaseFirst } from "@/utils"

import { FolderList } from "./FolderList"
import { TaskDetail } from "./TaskDetail"
import TaskList from "./TaskList"
import { TaskListMenu } from "./TaskListMenu"
import {
  OrderDir,
  orders,
  Orders,
  TaskView,
  TaskViews,
  useGetTask,
  useNewTask,
  useTasks,
} from "./data"
import { useRouting } from "./routing"

function isSameDay(today: Date) {
  return (someDate: Date) => {
    return (
      someDate.getDate() == today.getDate() &&
      someDate.getMonth() == today.getMonth() &&
      someDate.getFullYear() == today.getFullYear()
    )
  }
}

function filterByCategory(category: TaskView) {
  switch (category) {
    case "important":
      return A.filter((t: Todo.Task) => t.isFavorite)
    case "my-day": {
      const isToday = isSameDay(new Date())
      return A.filter((t: Todo.Task) =>
        t.myDay["|>"](O.map(isToday))["|>"](O.getOrElse(() => false))
      )
    }
    default:
      return identity
  }
}

const AddTask = memo(function ({
  category,
  setSelectedTaskId,
}: {
  category: TaskView
  setSelectedTaskId: (i: UUID) => void
}) {
  const { runPromise } = useServiceContext()
  const [newResult, addNewTask] = useNewTask(category)

  const [findResult, getTask] = useGetTask()

  const addTask = withLoading(
    flow(
      addNewTask,
      T.chain((r) => getTask(r.id)),
      EO.map((t) => setSelectedTaskId(t.id)),
      runPromise
    ),
    // TODO: or refreshing
    datumEither.isPending(newResult) || datumEither.isPending(findResult)
  )
  return (
    <div>
      <Field
        size="small"
        fullWidth
        placeholder="Add a Task"
        disabled={addTask.loading}
        onChange={addTask}
      />
    </div>
  )
})

const TasksL = memo(function ({
  category,
  order,
  orderDirection,
}: {
  category: TaskView
  order: O.Option<Orders>
  orderDirection: O.Option<OrderDir>
}) {
  const [tasksResult, , refetchTasks] = useTasks()

  useInterval(() => refetchTasks, 30 * 1000)

  // testing for multi-call relying on same network-call/cache.
  //   useTasks()
  //   useTasks()

  const filter = filterByCategory(category)
  const orderDir = orderDirection["|>"](O.getOrElse(() => "up"))

  const ordering = order["|>"](O.chain((o) => O.fromNullable(orders[o])))
    ["|>"](O.map(A.single))
    ["|>"](O.getOrElse(() => [] as A.Array<ORD.Ord<Todo.Task>>))
    ["|>"](A.map((o) => (orderDir === "down" ? ORD.inverted(o) : o)))

  const { setDirection, setOrder, setSelectedTaskId } = useRouting(
    category,
    order,
    orderDirection
  )
  const isRefreshing = datumEither.isRefresh(tasksResult)

  function renderTasks(unfilteredTasks: A.Array<Todo.Task>) {
    const tasks = unfilteredTasks["|>"](filter)["|>"](A.sortBy(ordering))

    return (
      <>
        <Box display="flex">
          <h1>
            {toUpperCaseFirst(category)} {isRefreshing && <Refresh />}
          </h1>

          <Box marginLeft="auto" marginTop={1}>
            <TaskListMenu setOrder={setOrder} order={order} />
          </Box>
        </Box>

        {O.isSome(order) && (
          <div>
            {order.value}
            <IconButton onClick={() => setDirection(orderDir === "up" ? "down" : "up")}>
              {orderDir === "up" ? <ArrowUp /> : <ArrowDown />}
            </IconButton>
            <Button onClick={() => setOrder(O.none)}>X</Button>
          </div>
        )}

        <Box flexGrow={1} overflow="auto">
          <TaskList setSelectedTaskId={setSelectedTaskId} tasks={tasks} />
        </Box>
        <AddTask category={category} setSelectedTaskId={setSelectedTaskId} />
      </>
    )
  }

  return tasksResult["|>"](
    datumEither.fold(
      () => <div>Hi there... about to get us some Tasks</div>,
      () => <div>Getting us some tasks now..</div>,
      (err) => <>{"Error Refreshing tasks: " + JSON.stringify(err)}</>,
      renderTasks,
      (err) => <>{"Error Loading tasks: " + JSON.stringify(err)}</>,
      renderTasks
    )
  )
})

const emptyTasks = [] as readonly Todo.Task[]

const TasksScreen = memo(function ({
  category,
  order,
  orderDirection,
  taskId,
}: {
  category: O.Option<TaskView>
  order: O.Option<Orders>
  orderDirection: O.Option<OrderDir>
  taskId: O.Option<string>
}) {
  const [tasksResult] = useTasks()
  const unfilteredTasks = datumEither.isSuccess(tasksResult)
    ? tasksResult.value.right
    : emptyTasks
  // TODO: count
  // only change when counts change..
  const folders = React.useMemo(
    () =>
      [
        ...TaskViews["|>"](
          A.map((c) => ({
            slug: c as NonEmptyString,
            tasks: unfilteredTasks["|>"](filterByCategory(c)),
          }))
        )["|>"](
          A.map(({ slug, tasks }) =>
            Todo.FolderListADT.of.TaskListView({
              title: toUpperCaseFirst(slug) as NonEmptyString,
              slug,
              count: tasks.length, // should not have separate count if tasks would be provided, but we shouldnt need to provide the tasks in the folderlist anyhow.
              tasks,
            })
          )
        ),
        Todo.FolderListADT.of.TaskList({
          title: "Some list" as NonEmptyString,
          tasks: [],
        }),
        Todo.FolderListADT.of.TaskListGroup({
          title: "Leisure" as NonEmptyString,
          lists: [
            Todo.FolderListADT.as.TaskList({
              title: "Leisure 1" as NonEmptyString,
              tasks: [],
            }),
            Todo.FolderListADT.as.TaskList({
              title: "Leisure 2" as NonEmptyString,
              tasks: [],
            }),
          ],
        }),
        Todo.FolderListADT.of.TaskList({
          title: "Some other list" as NonEmptyString,
          tasks: [],
        }),
      ] as const,
    [unfilteredTasks]
  )

  const t = taskId["|>"](
    O.chain((taskId) => O.fromNullable(unfilteredTasks.find((x) => x.id === taskId)))
  )["|>"](O.toNullable)

  const { setSelectedTaskId } = useRouting(
    O.getOrElse_(category, () => "tasks"),
    order,
    orderDirection
  )

  const closeTaskDetail = useCallback(() => setSelectedTaskId(null), [
    setSelectedTaskId,
  ])

  return (
    <Box display="flex" height="100%">
      <Box
        flexBasis="200px"
        style={{ backgroundColor: "#efefef" }}
        paddingX={1}
        paddingTop={7}
        paddingBottom={2}
        overflow="auto"
      >
        <FolderList folders={folders} />
      </Box>

      <Box
        display="flex"
        flexDirection="column"
        flexGrow={1}
        paddingX={2}
        paddingBottom={2}
      >
        {O.fold_(
          category,
          () => "List not found",
          (category) => (
            <TasksL category={category} order={order} orderDirection={orderDirection} />
          )
        )}
      </Box>

      {t && (
        <Box
          display="flex"
          flexBasis="300px"
          paddingX={2}
          paddingTop={2}
          paddingBottom={1}
          width="400px"
          style={{ backgroundColor: "#efefef" }}
        >
          <TaskDetail task={t} closeTaskDetail={closeTaskDetail} />
        </Box>
      )}
    </Box>
  )
})

export default TasksScreen