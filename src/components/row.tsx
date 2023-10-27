import { Match, Switch } from "solid-js"
import { RowDelimiter } from "./row-delimiter"

export interface JsonRowProps {
    level: number
    type: "primitive" | "object" | "array" | "close-bracket" | "close-brace"
    primitiveType?:
        | "string"
        | "number"
        | "bigint"
        | "boolean"
        | "symbol"
        | "undefined"
        | "object"
        | "function"
        | "undefined"
    key: string
    value?: any
    isParentArray?: boolean
    length?: number
    rect?: any
    estimateSize?: (length: number) => number
    selected?: boolean
}

export const Row = (props: JsonRowProps) => {
    if (props.type === "close-bracket" || props.type === "close-brace") {
        return (
            <div class="row">
                <RowDelimiter level={props.level} />
                <span class="json_object_token">{props.type === "close-bracket" ? `}` : `]`}</span>
            </div>
        )
    }

    const size = props.estimateSize(props.length)

    return (
        <div
            class="row"
            classList={{
                selected: props.selected,
            }}
            style={{
                height: `${size}px`,
                "max-height": `${size}px`,
                "min-height": `${size}px`,
            }}
        >
            <RowDelimiter level={props.level} />
            <span class="json_key" style={props.isParentArray ? { color: "#bfbfbf" } : {}}>
                {props.key}:
            </span>
            <Switch
                fallback={
                    <span class="value">
                        {props.primitiveType === "string" ? `\"${props.value}\"` : props.value}
                    </span>
                }
            >
                <Match when={props.type === "array"}>
                    <span class="json_object_token">{`[`}</span>
                </Match>
                <Match when={props.type === "object"}>
                    <span class="json_object_token">{`{`}</span>
                </Match>
            </Switch>
        </div>
    )
}
