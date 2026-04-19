let editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
    mode: "python",
    theme: "material-darker",
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    smartIndent: true,
    autoCloseBrackets: true,
    matchBrackets: true
});

let pyodide;
let pronto = false;

let saida = document.getElementById("saida");
let hiddenInput = document.getElementById("hiddenInput");

let inputResolve = null;
let buffer = "";
let terminalTexto = "";

// ===== FOCO (CORRETO PARA MOBILE) =====
saida.addEventListener("click", () => hiddenInput.focus());
saida.addEventListener("touchstart", () => hiddenInput.focus());

// ===== TERMINAL =====
function renderCursor(texto) {
    saida.innerHTML = "";

    const textNode = document.createTextNode(texto);
    const cursor = document.createElement("span");

    cursor.id = "cursor";
    cursor.className = "blink";
    cursor.textContent = " ";

    saida.appendChild(textNode);
    saida.appendChild(cursor);

    moverCursorFim();
}

function append(txt) {
    terminalTexto += txt;
    renderCursor(terminalTexto);
}

function moverCursorFim() {
    saida.scrollTop = saida.scrollHeight;
}

// ===== INPUT MOBILE ROBUSTO =====

function finalizarInput() {
    append("\n");
    inputResolve(buffer);

    buffer = "";
    inputResolve = null;
    hiddenInput.value = "";
}

// 🔥 1. BEFOREINPUT (mais confiável no mobile moderno)
hiddenInput.addEventListener("beforeinput", (e) => {
    if (!inputResolve) return;

    if (e.inputType === "insertLineBreak") {
        e.preventDefault();
        finalizarInput();
    }
});

// 🔥 2. INPUT (alguns Android mandam \n aqui)
hiddenInput.addEventListener("input", () => {
    if (!inputResolve) return;

    let value = hiddenInput.value;

    if (value.includes("\n")) {
        hiddenInput.value = "";
        finalizarInput();
        return;
    }

    buffer += value;
    append(value);

    hiddenInput.value = "";
});

// 🔥 3. KEYDOWN (fallback universal)
hiddenInput.addEventListener("keydown", (e) => {
    if (!inputResolve) return;

    if (e.key === "Enter") {
        e.preventDefault();
        finalizarInput();
    }

    if (e.key === "Backspace") {
        e.preventDefault();

        buffer = buffer.slice(0, -1);
        terminalTexto = terminalTexto.slice(0, -1);

        renderCursor(terminalTexto);
    }
});

// ===== PYTHON =====
async function iniciarPython() {
    pyodide = await loadPyodide();
    pronto = true;
    document.getElementById("status").innerText = "Python pronto 🚀";
    terminalTexto = "";
    renderCursor("");
}
iniciarPython();

// ===== EXECUÇÃO =====
async function executar() {

    if (!pronto) return;

    let codigo = editor.getValue();

    buffer = "";
    terminalTexto = "";
    renderCursor("");

    try {

        window.pegarInput = (msg) => {
            append(msg);

            // 🔥 FOCO CORRETO
            hiddenInput.focus();

            return new Promise(resolve => {
                inputResolve = resolve;
            });
        };

        window.escrever = (txt) => {
            append(txt);
        };

        codigo = codigo.replaceAll("input(", "await input(");

        let codigoIndentado = codigo
            .split("\n")
            .map(l => "    " + l)
            .join("\n");

        let pycode =
            "from js import pegarInput, escrever\n" +
            "\n" +
            "def print(*args):\n" +
            "    escrever(' '.join(map(str,args)) + '\\n')\n" +
            "\n" +
            "async def input(msg=''):\n" +
            "    return await pegarInput(msg)\n" +
            "\n" +
            "async def __run():\n" +
            codigoIndentado + "\n" +
            "\n" +
            "await __run()";

        await pyodide.runPythonAsync(pycode);

    } catch (erro) {
        append("\nErro: " + erro + "\n");
    }
}

// ===== UTIL =====
function limpar() {
    buffer = "";
    terminalTexto = "";
    renderCursor("");
}

function salvar() {
    let nome = prompt("Nome do arquivo:", "codigo.py");
    if (!nome) return;

    if (!nome.endsWith(".py")) nome += ".py";

    let blob = new Blob([editor.getValue()], { type: "text/x-python" });
    let link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = nome;
    link.click();
}
