export function App() {
  return (
    <main className="workspace-shell">
      <header className="command-bar">
        <strong>数据流水线</strong>
        <span className="baseline-badge">M0 工程基线</span>
      </header>
      <aside className="node-library" aria-label="节点库">
        <h2>节点</h2>
        <p>输入与转换节点将在 M1 接入。</p>
      </aside>
      <section className="canvas" aria-label="流水线画布">
        <div>
          <h1>创建第一条数据流水线</h1>
          <p>导入数据、连接转换节点，并在浏览器本地运行。</p>
        </div>
      </section>
      <aside className="inspector" aria-label="配置面板">
        <h2>配置</h2>
        <p>选择节点后在此编辑参数。</p>
      </aside>
      <section className="data-panel" aria-label="数据预览">
        <strong>数据预览</strong>
        <span>尚未运行</span>
      </section>
    </main>
  );
}
