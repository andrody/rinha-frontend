import { Accessor, Setter, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { JsonRowProps, Row } from "./components/row"
import { createWindowVirtualizer } from "@tanstack/solid-virtual"
import { throttle } from "@solid-primitives/scheduled"

const TREE_PAGE_SIZE = 800000
let lastOffset = -1

function JsonViewer(props: {
    jsonTree: Accessor<JsonRowProps[] | undefined>
    transformWorker: Worker
    ended: Accessor<boolean>
    fileName: Accessor<string>
    searchResultIndex: Accessor<number>
    setSearchResultIndex: Setter<number>
    searching: Accessor<boolean>
    turboFinished: Accessor<boolean>
    setSearching: Setter<boolean>
    searchScopeMode: Accessor<boolean>
    isPartial: Accessor<boolean>
    totalRows: Accessor<number>
    setSearchScopeMode: Setter<boolean>
}) {
    let parentRef!: HTMLDivElement
    const [rect, setRect] = createSignal({
        height: window.innerHeight,
        width: window.innerWidth,
    })
    const [search, setSearch] = createSignal("")
    const [selectedIndex, setSelectedIndex] = createSignal()
    const [parentOffset, setParentOffset] = createSignal(0)
    const [page, setPage] = createSignal(0)
    const [progress, setProgress] = createSignal("0")
    const [jsonTreePage, setJsonTreePage] = createSignal([])
    const [searchBuffer, setSearchBuffer] = createSignal<string | undefined>()
    let fetching = false

    const handler = (event: Event) => {
        setRect({ height: window.innerHeight, width: window.innerWidth })
    }

    onMount(() => {
        console.timeEnd("Tree rendered")
        window.addEventListener("resize", handler)
    })

    onCleanup(() => {
        window.removeEventListener("resize", handler)
    })

    createEffect(() => {
        setParentOffset(parentRef?.offsetTop ?? 0)
    })

    const calculateProgress = throttle(() => {
        const progress =
            ((virtualizer.getVirtualItems()?.at(-1)?.index + 5 + page() * TREE_PAGE_SIZE) * 100) /
            props.totalRows()

        if (progress >= 100) {
            setProgress("100")
            return
        }

        setProgress(progress >= 0 ? progress.toFixed(2) : "0")
    }, 250)

    createEffect(() => {
        const offset = page() * TREE_PAGE_SIZE
        setJsonTreePage(props.jsonTree()?.slice(offset, offset + TREE_PAGE_SIZE) ?? [])
    })

    const estimateSize = (length: number) => {
        const isMobile = rect().width <= 638
        const lines = length ? Math.floor(length / (isMobile ? 15 : 30)) || 1 : 1
        return 30 + ((lines ?? 1) - 1) * (isMobile ? 30 : 15)
    }

    const virtualizer = createWindowVirtualizer({
        count: jsonTreePage?.()?.length ?? 0,
        estimateSize: (i) => {
            const length = jsonTreePage?.()?.[i]?.length
            return estimateSize(length)
        },
        get scrollMargin() {
            return parentOffset()
        },
        overscan: 10,
    })

    createEffect(() => {
        jsonTreePage?.()
        virtualizer.getVirtualItems()?.length
        virtualizer.setOptions({
            ...virtualizer.options,
            count: jsonTreePage?.()?.length ?? 0,
        })
        if (fetching) {
            fetching = false
        }
        virtualizer.measure()
        setTimeout(() => {
            virtualizer.measure()
        }, 1)
    })

    createEffect(() => {
        const lastItem = virtualizer.getVirtualItems()?.at(-1)
        calculateProgress()

        if (
            !props.isPartial() &&
            lastItem?.index + page() * TREE_PAGE_SIZE >= props.jsonTree()?.length - 1 &&
            !fetching &&
            !props.searchScopeMode() &&
            lastOffset !== props.jsonTree()?.length
        ) {
            fetching = true
            lastOffset = props.jsonTree()?.length
            lastOffset
            props.transformWorker.postMessage({
                offset: props.jsonTree()?.length,
            })
        }
    })

    createEffect(() => {
        if (props.turboFinished() && searchBuffer()) {
            props.transformWorker.postMessage({
                search: searchBuffer(),
                loadedLength: jsonTreePage?.()?.length,
            })
            setSearchBuffer(undefined)
        }
    })

    createEffect(() => {
        if (props.searchResultIndex() !== undefined) {
            if (props.searchResultIndex() > -1) {
                setSelectedIndex(props.searchResultIndex())
                setTimeout(() => {
                    virtualizer.scrollToIndex(props.searchResultIndex() + 10)
                    props.setSearchResultIndex(undefined)
                }, 10)
            }
        }
    })

    const exitSearchScopeMode = () => {
        props.transformWorker.postMessage({
            reset: true,
        })
    }

    return (
        <div class="json_tree">
            <header>
                <h1 class="title_file_name">{props.fileName()}</h1>
                <form
                    action="#"
                    style={{ position: "relative" }}
                    onSubmit={(e) => {
                        e?.preventDefault?.()
                        if (!search()) {
                            return
                        }

                        props.setSearching(true)
                        if (props.turboFinished()) {
                            props.transformWorker.postMessage({
                                search: search(),
                                loadedLength: jsonTreePage?.()?.length,
                            })
                        } else {
                            setSearchBuffer(search())
                        }
                    }}
                >
                    <Show
                        when={props.searching()}
                        fallback={
                            <svg
                                class="search_icon"
                                xmlns="http://www.w3.org/2000/svg"
                                width="32"
                                height="32"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    fill="currentColor"
                                    d="M9.5 16q-2.725 0-4.612-1.888T3 9.5q0-2.725 1.888-4.612T9.5 3q2.725 0 4.612 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l5.6 5.6q.275.275.275.7t-.275.7q-.275.275-.7.275t-.7-.275l-5.6-5.6q-.75.6-1.725.95T9.5 16Zm0-2q1.875 0 3.188-1.313T14 9.5q0-1.875-1.313-3.188T9.5 5Q7.625 5 6.312 6.313T5 9.5q0 1.875 1.313 3.188T9.5 14Z"
                                />
                            </svg>
                        }
                    >
                        <svg
                            class="search_icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                        >
                            <path
                                fill="none"
                                stroke="currentColor"
                                stroke-dasharray="15"
                                stroke-dashoffset="15"
                                stroke-linecap="round"
                                stroke-width="2"
                                d="M12 3C16.9706 3 21 7.02944 21 12"
                            >
                                <animate
                                    fill="freeze"
                                    attributeName="stroke-dashoffset"
                                    dur="0.3s"
                                    values="15;0"
                                />
                                <animateTransform
                                    attributeName="transform"
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                    type="rotate"
                                    values="0 12 12;360 12 12"
                                />
                            </path>
                        </svg>
                    </Show>
                    <input
                        type="search"
                        placeholder="Search..."
                        class="search"
                        value={search()}
                        disabled={props.searching() || props.searchScopeMode()}
                        onChange={(event) => {
                            if (selectedIndex()) {
                                setSelectedIndex(undefined)
                            }
                            setSearch(event.target.value)
                        }}
                    />
                </form>
            </header>
            <Show when={props.searchScopeMode()}>
                <button
                    class="full_btn"
                    onClick={() => {
                        exitSearchScopeMode()
                    }}
                >
                    Voltar do contexto de pesquisa
                </button>
            </Show>
            <Show when={page() > 0}>
                <button
                    class="full_btn"
                    onClick={() => {
                        setPage(page() - 1)
                        window.scrollTo(0, document.body.scrollHeight + 2000)
                        setTimeout(() => {
                            window.scrollTo(0, document.body.scrollHeight + 2000)
                            setTimeout(() => {
                                window.scrollTo(0, document.body.scrollHeight + 2000)
                            }, 100)
                        }, 10)
                    }}
                >
                    Voltar para página {page()}
                </button>
            </Show>
            <section ref={parentRef} class="json_viewer">
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    <ul
                        class="json_ul"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${
                                virtualizer.getVirtualItems()?.[0]?.start -
                                virtualizer.options.scrollMargin
                            }px)`,
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => (
                            <li
                                data-index={virtualRow.index}
                                ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
                            >
                                <Row
                                    {...jsonTreePage?.()?.[virtualRow.index]!}
                                    estimateSize={estimateSize}
                                    selected={selectedIndex() === virtualRow.index}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
            <Show when={props.searchScopeMode()}>
                <button
                    class="full_btn"
                    onClick={() => {
                        exitSearchScopeMode()
                    }}
                >
                    Voltar do contexto de pesquisa
                </button>
            </Show>
            <Show when={virtualizer.getVirtualItems()?.at(-1)?.index >= TREE_PAGE_SIZE - 10}>
                <button
                    class="full_btn"
                    onClick={() => {
                        window.scrollTo(0, 0)
                        setPage(page() + 1)
                    }}
                    style={{
                        position: "absolute",
                        bottom: "-18px",
                    }}
                >
                    Ir para página {page() + 2}
                </button>
                <br />
                <br />
            </Show>
            <Show when={props.totalRows() > 0}>
                <div class="percentage">{progress()}%</div>
            </Show>
        </div>
    )
}

export default JsonViewer
