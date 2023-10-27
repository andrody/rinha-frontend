import { Show, createSignal } from "solid-js"
import "./App.css"
import { JsonRowProps } from "./components/row"
import JsonViewer from "./json-viewer"
import { Puff } from "solid-spinner"

function App() {
    let fileInputRef: any
    const [jsonTree, setJsonTree] = createSignal<JsonRowProps[]>()
    const [fileName, setFileName] = createSignal<string>()
    const [loading, setLoading] = createSignal(false)
    const [dark, setDark] = createSignal(false)
    const [ended, setEnded] = createSignal(false)
    const [turboFinished, setTurboFinished] = createSignal(false)
    const [error, setError] = createSignal(false)
    const [searchResultIndex, setSearchResultIndex] = createSignal<number | undefined>()
    const [searching, setSearching] = createSignal(false)
    const [searchScopeMode, setSearchScopeMode] = createSignal(false)
    const [isPartial, setIsPartial] = createSignal(true)
    const [totalRows, setTotalRows] = createSignal(-1)
    let pageSearchAcc = []

    const transformWorker = new Worker(new URL("./worker.ts", import.meta.url))
    transformWorker.onmessage = async (e: any) => {
        if (e?.data?.error) {
            setError(true)
            setLoading(false)
            return
        }
        if (e?.data?.pageParcial) {
            setJsonTree(e?.data?.pageParcial)
            return
        }
        if (!ended()) {
            if (isPartial() && e.data.page.length > 0) {
                setIsPartial(false)
                setJsonTree(e.data.page)
            } else {
                setJsonTree((x) => (x || []).concat(e.data.page))
            }
            if (e.data.end) {
                setEnded(true)
                transformWorker.terminate()
            }
        }
    }

    const transformWorkerTurbo = new Worker(new URL("./worker.ts", import.meta.url))
    transformWorkerTurbo.onmessage = async (e: any) => {
        if (e?.data?.error) {
            setError(true)
            setLoading(false)
            return
        }
        if (e?.data?.reset) {
            setSearchScopeMode(false)
            setJsonTree(e?.data?.page)
            window.scrollTo(30, 0)
            setTimeout(() => {
                window.scrollTo(0, 0)
            }, 100)
            return
        }
        if (e?.data?.finishedProcessing) {
            console.log("Turbo Ready ⚡️")
            setTurboFinished(true)
            setTotalRows(e.data.totalRows)
            setTimeout(() => {
                transformWorker.terminate()
            }, 100)
        }

        if (e?.data?.searchScopeMode) {
            setJsonTree(e?.data?.pageSearch)
            setSearching(false)
            setSearchScopeMode(true)
            setTimeout(() => {
                setSearchResultIndex(e.data.searchResultIndex)
            }, 100)

            return
        }

        if (e?.data?.searchResultIndex) {
            if (pageSearchAcc?.length) {
                setJsonTree((x) => (x || []).concat(pageSearchAcc))
                pageSearchAcc = []
            }

            setSearching(false)

            if (e.data.searchResultIndex === -1) {
                alert("No results found")
            }

            setTimeout(() => {
                setSearchResultIndex(e.data.searchResultIndex), 10
            })

            return
        }

        if (e?.data?.pageSearch) {
            pageSearchAcc = pageSearchAcc.concat(e.data.pageSearch)
            return
        }

        if (!ended() && e.data.page) {
            setJsonTree((x) => (x || []).concat(e.data.page))
            if (e.data.end) {
                setEnded(true)
            }
        }
    }

    return (
        <div
            classList={{
                dark: dark(),
            }}
        >
            <div class="actions">
                <button
                    class="action"
                    title="Toggle dark mode"
                    aria-label="Toggle dark mode"
                    onClick={() => {
                        if (dark()) {
                            document.body.style.backgroundColor = "white"
                        } else {
                            document.body.style.backgroundColor = "black"
                        }
                        setDark(!dark())
                    }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                    >
                        <path
                            fill="currentColor"
                            d="M12 21q-3.75 0-6.375-2.625T3 12q0-3.75 2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.638 1.888T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21Zm0-2q2.2 0 3.95-1.213t2.55-3.162q-.5.125-1 .2t-1 .075q-3.075 0-5.238-2.163T9.1 7.5q0-.5.075-1t.2-1q-1.95.8-3.163 2.55T5 12q0 2.9 2.05 4.95T12 19Zm-.25-6.75Z"
                        />
                    </svg>
                </button>
            </div>
            <Show
                when={jsonTree() && !error()}
                fallback={
                    <>
                        <h1 class="title">JSON Tree Viewer</h1>
                        <p class="subtitle">
                            Simple JSON Viewer that runs completely on-client. No data exchange
                        </p>
                        <Show when={!loading()} fallback={<Puff color="#0C6451" />}>
                            <button
                                onClick={() => {
                                    fileInputRef?.click?.()
                                }}
                            >
                                Load JSON
                            </button>
                        </Show>
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={async (event) => {
                                console.time("Tree rendered")

                                setFileName(event?.target?.files?.[0]?.name)
                                const file = event?.target?.files?.[0]
                                setLoading(true)
                                setError(false)

                                transformWorker.postMessage({ file, parcial: true })

                                setTimeout(() => {
                                    // Init turbo after 2s
                                    if (!error()) {
                                        transformWorkerTurbo.postMessage({ file, turbo: true })
                                    }
                                }, 2000)
                            }}
                        />
                        {error() && (
                            <div
                                style={{
                                    color: "#BF0E0E",
                                    "margin-top": "25px",
                                }}
                            >
                                Invalid file. Please load a valid JSON file.
                            </div>
                        )}
                        <p class="footer">
                            Feito com 💚 por Andrew Feitosa para a Rinha de Frontend da{" "}
                            <a
                                class="link"
                                href="https://codante.io/mini-projetos/rinha-frontend"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Codante.io
                            </a>
                        </p>
                    </>
                }
            >
                <JsonViewer
                    jsonTree={jsonTree}
                    transformWorker={turboFinished() ? transformWorkerTurbo : transformWorker}
                    ended={ended}
                    fileName={fileName}
                    searchResultIndex={searchResultIndex}
                    setSearchResultIndex={setSearchResultIndex}
                    searching={searching}
                    setSearching={setSearching}
                    turboFinished={turboFinished}
                    searchScopeMode={searchScopeMode}
                    setSearchScopeMode={setSearchScopeMode}
                    isPartial={isPartial}
                    totalRows={totalRows}
                />
            </Show>
        </div>
    )
}

export default App
