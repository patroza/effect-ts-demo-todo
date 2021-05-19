import { handle } from "@effect-ts-app/infra/app"
import { Tasks } from "@effect-ts-demo/todo-client"
import { User } from "@effect-ts-demo/todo-types"
import * as T from "@effect-ts/core/Effect"

import { TodoContext, UserSVC } from "@/services"

import { TaskAuth } from "./_access"

export default handle(Tasks.Update)(({ id, myDay, ..._ }) =>
  T.gen(function* ($) {
    const { Lists, Tasks, Users } = yield* $(TodoContext.TodoContext)

    const user = yield* $(UserSVC.UserEnv)
    const taskLists = yield* $(Lists.allLists(user.id))
    const task = yield* $(
      Tasks.updateM(
        id,
        TaskAuth(taskLists).access(user.id, (tl) => ({
          ...tl,
          ..._,
          updatedAt: new Date(),
        }))
      )
    )
    if (myDay) {
      yield* $(Users.update(user.id, User.toggleMyDay(task, myDay)))
    }
  })
)
