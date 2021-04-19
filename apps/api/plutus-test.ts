import * as Plutus from "@atlas-ts/plutus"
import { generateMerged } from "@atlas-ts/plutus/Gen"
import { NonEmptyString } from "@effect-ts-demo/todo-types/shared"
import * as T from "@effect-ts/core/Effect"
import { make } from "@effect-ts/morphic"

import pkg from "package.json"

export const generatePlutus = T.gen(function* ($) {
  const api = Plutus.api({
    info: Plutus.info({
      title: pkg.name,
      version: pkg.version,
      pageTitle: pkg.name,
    }),
    tags: Plutus.tags(Plutus.tag({ name: "Who", description: "Who dunnut" })),
  })(({ pathItem, responses, tags }) => {
    return {
      ...pathItem("/who/role/assume/{my}/{id}", ({ methods, operation }) => ({
        methods: methods({
          POST: operation(({ parameters }) => ({
            operationId: "assumeRole",
            summary: "Assume Role",
            description:
              "Assume an identity role, roles are principals that can be used in policies",
            tags: tags("Who"),
            parameters: parameters({
              path: {
                ...Plutus.parameter("id", true, {
                  content: NonEmptyString,
                  description: "ac",
                }),
                ...Plutus.parameter("my", true, {
                  content: NonEmptyString,
                  description: "ac",
                }),
              },
              //   header: {
              //     ...AuthTokenHeader,
              //     ...XProjectIdHeader,
              //   },
            }),
            requestBody: Plutus.requestBody(true, {
              content: T.succeedWith(() =>
                make((F) =>
                  F.interface({
                    a: F.string(),
                  })
                )
              ),
            }),
            responses: responses({
              //...AuthTokenResponse,
            }),
          })),
        }),
      })),
    }
  })

  const abc = yield* $(
    generateMerged({
      title: "Atlas API",
      pageTitle: "Atlas API Documentation",
      license: {
        _tag: "License",
        name: "MIT",
        url: "https://atlas.matechs.com/license",
      },
      description: "The API of the Matechs Atlas Platform",
      tos: "https://atlas.matechs.com/terms",
      version: "0.0.0",
      contact: {
        _tag: "ContactInfo",
        email: "api@atlas-ts.matechs.com",
        url: "https://atlas.matechs.com/support",
        name: "Atlas Support",
      },
    })(api)
  )
  return abc
})