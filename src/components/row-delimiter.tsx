import { For } from "solid-js"

export const RowDelimiter = (props: { level: number }) => {
    let array = new Array(props.level)

    return (
        <>
            {props.level > 0 && (
                <div style={{ display: "flex " }}>
                    <For each={array}>
                        {(_) => {
                            return (
                                <span
                                    class="json_level"
                                    style={{
                                        "margin-right": "13px",
                                    }}
                                />
                            )
                        }}
                    </For>
                </div>
            )}
        </>
    )
}
