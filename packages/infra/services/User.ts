import { pipe } from "@effect-ts-demo/core/ext/Function"
import * as S from "@effect-ts-demo/core/ext/Schema"
import { Has } from "@effect-ts/core"
import * as L from "@effect-ts/core/Effect/Layer"

import { jwt } from "../express/schema/jwt"

export class UserProfile extends S.Model<UserProfile>()(
  S.mapField(
    S.required({
      /**
       * Mapped from "sub"
       */
      id: S.nonEmptyString,
    }),
    "id",
    "sub"
  )
) {}

export interface UserEnv extends UserProfile {}
export const UserEnv = Has.tag<UserEnv>()

export const LiveUserEnv = (profile: UserProfile) => L.pure(UserEnv)(profile)

const userProfileFromJson = S.json[">>>"](UserProfile.Model)
const parseUserProfileFromJson = S.Parser.for(userProfileFromJson)
const userProfileFromJWT = jwt[">>>"](UserProfile.Model)
const parseUserProfileFromJWT = S.Parser.for(userProfileFromJWT)

export const LiveUserEnvFromAuthorizationHeader = (authorization: unknown) =>
  L.fromEffect(UserEnv)(
    pipe(parseUserProfileFromJWT["|>"](S.condemnFail)(authorization))
  )
export const LiveUserEnvFromUserHeader = (user: unknown) =>
  L.fromEffect(UserEnv)(pipe(parseUserProfileFromJson["|>"](S.condemnFail)(user)))
