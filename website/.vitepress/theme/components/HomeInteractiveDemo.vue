<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

type DemoStep = {
  id: string;
  label: string;
  kicker: string;
  title: string;
  activeLines: number[];
  panel: 'completion' | 'hover' | 'diagnostic' | 'fragment';
};

const steps: DemoStep[] = [
  {
    id: 'complete',
    label: 'Autocomplete',
    kicker: 'Write GraphQL in TypeScript',
    title: 'Schema-aware completion inside template strings.',
    activeLines: [6, 7, 8, 9],
    panel: 'completion',
  },
  {
    id: 'types',
    label: 'Type hints',
    kicker: 'No generated operation files',
    title: 'Result and variable types appear where you use them.',
    activeLines: [22, 23, 24, 25],
    panel: 'hover',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    kicker: 'Feedback while you type',
    title: 'Unused fields and invalid selections are caught early.',
    activeLines: [17],
    panel: 'diagnostic',
  },
  {
    id: 'fragments',
    label: 'Fragments',
    kicker: 'Safer colocation',
    title: 'Fragment masks keep component boundaries explicit.',
    activeLines: [4, 5, 16, 20, 27],
    panel: 'fragment',
  },
];

const codeLines = [
  '<span class="tok-keyword">import</span> { <span class="tok-function">graphql</span>, <span class="tok-function">readFragment</span> } <span class="tok-keyword">from</span> <span class="tok-string">\'gql.tada\'</span>;',
  '<span class="tok-keyword">import</span> { <span class="tok-function">useQuery</span> } <span class="tok-keyword">from</span> <span class="tok-string">\'urql\'</span>;',
  '',
  '<span class="tok-keyword">const</span> <span class="tok-symbol">PokemonCard</span> = <span class="tok-function">graphql</span>(<span class="tok-template">`</span>',
  '  <span class="tok-graphql-keyword">fragment</span> <span class="tok-type">PokemonCard</span> <span class="tok-graphql-keyword">on</span> <span class="tok-type">Pokemon</span> {',
  '    <span class="tok-field">id</span>',
  '    <span class="tok-field">name</span>',
  '    <span class="tok-field">types</span>',
  '    <span class="tok-field">sprite</span>',
  '  }',
  '<span class="tok-template">`</span>);',
  '',
  '<span class="tok-keyword">const</span> <span class="tok-symbol">PokemonsQuery</span> = <span class="tok-function">graphql</span>(<span class="tok-template">`</span>',
  '  <span class="tok-graphql-keyword">query</span> <span class="tok-type">Pokemons</span>(<span class="tok-variable">$limit</span>: <span class="tok-type">Int</span>!) {',
  '    <span class="tok-field">pokemons</span>(<span class="tok-argument">limit</span>: <span class="tok-variable">$limit</span>) {',
  '      <span class="tok-spread">...PokemonCard</span>',
  '      <span class="tok-warning">height</span>',
  '    }',
  '  }',
  '<span class="tok-template">`</span>, [<span class="tok-symbol">PokemonCard</span>]);',
  '',
  '<span class="tok-keyword">const</span> [{ <span class="tok-symbol">data</span> }] = <span class="tok-function">useQuery</span>({',
  '  <span class="tok-property">query</span>: <span class="tok-symbol">PokemonsQuery</span>,',
  '  <span class="tok-property">variables</span>: { <span class="tok-property">limit</span>: <span class="tok-number">12</span> },',
  '});',
  '',
  '<span class="tok-keyword">const</span> <span class="tok-symbol">pokemon</span> = <span class="tok-function">readFragment</span>(<span class="tok-symbol">PokemonCard</span>, <span class="tok-symbol">data</span>?.<span class="tok-property">pokemons</span>[<span class="tok-number">0</span>]);',
];

const activeStepIndex = ref(0);
const progress = ref(0);
const activeStep = computed(() => steps[activeStepIndex.value]);
const stepDuration = 4600;
let frame = 0;
let stepStartedAt = 0;

function isActiveLine(lineNumber: number) {
  return activeStep.value.activeLines.includes(lineNumber);
}

function selectStep(index: number) {
  activeStepIndex.value = index;
  progress.value = 0;
  stepStartedAt = performance.now();
}

function progressStyle(index: number) {
  return {
    '--demo-progress': String(activeStepIndex.value === index ? progress.value : 0),
  };
}

function tick(now: number) {
  if (!stepStartedAt) stepStartedAt = now;
  progress.value = Math.min(1, (now - stepStartedAt) / stepDuration);

  if (progress.value >= 1) {
    activeStepIndex.value = (activeStepIndex.value + 1) % steps.length;
    progress.value = 0;
    stepStartedAt = now;
  }

  frame = requestAnimationFrame(tick);
}

onMounted(() => {
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
});
</script>

<template>
  <section class="home-demo" aria-labelledby="home-demo-title">
    <div class="home-demo__intro">
      <h2 id="home-demo-title">Instant editor feedback without a codegen loop.</h2>
    </div>

    <div class="home-demo__stage">
      <div class="home-demo__steps" aria-label="Demo mode">
        <button
          v-for="(step, index) in steps"
          :key="step.id"
          :aria-pressed="activeStepIndex === index"
          :style="progressStyle(index)"
          type="button"
          @click="selectStep(index)"
        >
          <span>{{ step.label }}</span>
        </button>
      </div>

      <div class="home-demo__editor" role="img" :aria-label="activeStep.title">
        <div class="home-demo__chrome">
          <div class="home-demo__traffic" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="home-demo__tabs">
            <span class="is-active">PokemonList.tsx</span>
          </div>
        </div>

        <div class="home-demo__workspace">
          <pre class="home-demo__code" aria-hidden="true"><code><span
            v-for="(line, index) in codeLines"
            :key="index"
            class="home-demo__line"
            :class="{ 'is-active': isActiveLine(index + 1) }"
          ><span class="home-demo__number">{{ index + 1 }}</span><span class="home-demo__text" v-html="line || ' '"></span></span></code></pre>

          <div class="home-demo__callout" :class="`is-${activeStep.panel}`">
            <span>{{ activeStep.kicker }}</span>
            <strong>{{ activeStep.title }}</strong>

            <div v-if="activeStep.panel === 'completion'" class="home-demo__completion">
              <div><span>name</span><small>String!</small></div>
              <div><span>types</span><small>[PokemonType!]!</small></div>
              <div><span>sprite</span><small>String</small></div>
            </div>

            <div v-else-if="activeStep.panel === 'hover'" class="home-demo__type-card">
              <code>
                <span><span class="tok-keyword">const</span> <span class="tok-symbol">data</span>: {</span>
                <span>&nbsp;&nbsp;<span class="tok-property">pokemons</span>: <span class="tok-type">Array</span>&lt;{</span>
                <span>&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-property">id</span>: <span class="tok-type">string</span>;</span>
                <span>&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-property">name</span>: <span class="tok-type">string</span>;</span>
                <span>&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-property">types</span>: <span class="tok-type">string</span>[];</span>
                <span>&nbsp;&nbsp;}&gt;</span>
                <span>}</span>
              </code>
            </div>

            <div v-else-if="activeStep.panel === 'diagnostic'" class="home-demo__diagnostic">
              <strong>Field "height" is queried but not used.</strong>
            </div>

            <div v-else class="home-demo__type-card">
              <code>
                <span><span class="tok-function">readFragment</span>(<span class="tok-symbol">PokemonCard</span>, <span class="tok-symbol">data</span>)</span>
              </code>
            </div>
          </div>
        </div>

        <div class="home-demo__footer">
          <span>Ready</span>
          <span>gql.tada/ts-plugin</span>
          <span>0 generated query files</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-demo {
  display: grid;
  grid-template-columns: minmax(20rem, 0.58fr) minmax(700px, 1.42fr);
  gap: 34px;
  align-items: center;
  width: min(calc(100vw - 48px), 1280px);
  margin: 3rem 50% 3.4rem;
  padding: 28px;
  transform: translateX(-50%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(68, 133, 229, 0.16), transparent 42%),
    linear-gradient(180deg, var(--vp-c-bg-alt), var(--vp-c-bg));
}

.home-demo__intro {
  min-width: 0;
}

.home-demo__intro p {
  width: fit-content;
  margin: 0 0 0.9rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-indigo-1);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.5;
}

.home-demo__intro h2 {
  margin: 0;
  max-width: 12ch;
  color: var(--vp-c-white);
  font-size: 4rem;
  line-height: 0.96;
  letter-spacing: 0;
}

.home-demo__stage {
  min-width: 0;
}

.home-demo__steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
  align-items: stretch;
}

.home-demo__steps button {
  appearance: none;
  box-sizing: border-box;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  min-width: 0;
  height: 38px;
  margin: 0 !important;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1;
  vertical-align: top;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease;
}

.home-demo__steps button:before {
  position: absolute;
  inset: 0;
  width: calc(var(--demo-progress, 0) * 100%);
  content: '';
  background: linear-gradient(90deg, rgba(68, 133, 229, 0.22), rgba(68, 133, 229, 0.08));
  transition: width 0.08s linear;
}

.home-demo__steps button span {
  position: relative;
  z-index: 1;
  display: block;
  height: auto;
  margin: 0 !important;
  line-height: 1;
  transform: translateY(0);
}

.home-demo__steps button[aria-pressed='true'] {
  border-color: var(--vp-c-indigo-2);
  background: rgba(68, 133, 229, 0.08);
  color: var(--vp-c-text-1);
}

.home-demo__editor {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #08090d;
  box-shadow: rgba(0, 0, 0, 0.24) 0 18px 48px;
}

:root:not(.dark) .home-demo__editor {
  border-color: #dbdce6;
  box-shadow: rgba(30, 36, 50, 0.14) 0 18px 48px;
}

.home-demo__chrome,
.home-demo__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(18, 19, 27, 0.9);
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.78rem;
}

.home-demo__traffic {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.home-demo__traffic span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
}

.home-demo__tabs {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  min-width: 0;
  gap: 4px;
  overflow: hidden;
  margin: 0 !important;
}

.home-demo__tabs span {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  margin: 0 !important;
  padding: 0 0.72rem;
  border-radius: 0;
  white-space: nowrap;
  font-weight: 600;
}

.home-demo__tabs .is-active {
  border-inline: 1px solid rgba(255, 255, 255, 0.08);
  background: #08090d;
  color: #fff;
}

.home-demo__workspace {
  position: relative;
  min-height: 480px;
  padding-right: 22rem;
  background:
    radial-gradient(circle at 80% 0%, rgba(68, 133, 229, 0.14), transparent 28%),
    #08090d;
}

.home-demo__code {
  margin: 0;
  padding: 18px 0;
  overflow: hidden;
  color: #d6d9e4;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre;
}

.home-demo__line {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  min-height: 1.55em;
  padding-right: 14px;
  transition: background-color 0.22s ease;
}

.home-demo__line.is-active {
  background: rgba(68, 133, 229, 0.17);
}

.home-demo__number {
  color: rgba(255, 255, 255, 0.32);
  text-align: right;
  padding-right: 1rem;
  user-select: none;
}

.home-demo__text {
  overflow: hidden;
  text-overflow: clip;
}

.home-demo :deep(.tok-keyword) {
  color: #ff8fac;
}

.home-demo :deep(.tok-function) {
  color: #82aaff;
}

.home-demo :deep(.tok-string),
.home-demo :deep(.tok-template) {
  color: #c3e88d;
}

.home-demo :deep(.tok-symbol),
.home-demo :deep(.tok-type) {
  color: #ffcb6b;
}

.home-demo :deep(.tok-graphql-keyword),
.home-demo :deep(.tok-variable) {
  color: #c792ea;
}

.home-demo :deep(.tok-field),
.home-demo :deep(.tok-property),
.home-demo :deep(.tok-argument) {
  color: #89ddff;
}

.home-demo :deep(.tok-spread) {
  color: #f78c6c;
}

.home-demo :deep(.tok-number) {
  color: #f78c6c;
}

.home-demo :deep(.tok-warning) {
  color: #ffd58a;
  text-decoration: underline;
  text-decoration-color: rgba(255, 213, 138, 0.7);
  text-decoration-style: wavy;
  text-underline-offset: 0.22em;
}

.home-demo__callout {
  position: absolute;
  z-index: 2;
  right: 18px;
  width: min(20rem, calc(100% - 36px));
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(12, 12, 17, 0.76);
  backdrop-filter: blur(24px) saturate(250%);
  box-shadow: rgba(0, 0, 0, 0.28) 0 14px 34px;
  color: #fff;
  transition:
    top 0.24s ease,
    transform 0.24s ease;
}

.home-demo__callout.is-completion {
  top: 116px;
}

.home-demo__callout.is-hover {
  top: 340px;
}

.home-demo__callout.is-diagnostic {
  top: 224px;
}

.home-demo__callout.is-fragment {
  top: 258px;
}

.home-demo__callout > span {
  color: #8eb4ef;
  font-size: 0.76rem;
  font-weight: 700;
}

.home-demo__callout > strong {
  display: block;
  margin-top: 0.42rem;
  font-size: 1rem;
  line-height: 1.26;
}

.home-demo__completion {
  margin-top: 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
}

.home-demo__completion div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 1.7rem;
  align-items: center;
  margin: 0 !important;
  padding: 0.2rem 0.5rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  line-height: 1;
}

.home-demo__completion div + div {
  margin-top: 0 !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.home-demo__completion small {
  color: rgba(255, 255, 255, 0.58);
}

.home-demo__type-card,
.home-demo__diagnostic {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  margin-top: 0.82rem !important;
}

.home-demo__type-card code {
  display: block;
  color: #fff;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.home-demo__type-card code > span {
  display: block;
  margin: 0 !important;
}

.home-demo__type-card code > span span {
  display: inline;
  margin: 0;
}

.home-demo__type-card span,
.home-demo__diagnostic span {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.78rem;
  line-height: 1.45;
}

.home-demo__diagnostic strong {
  color: #ffd58a;
  font-size: 0.84rem;
  line-height: 1.35;
}

.home-demo__footer {
  justify-content: space-between;
  min-height: 34px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 0;
}

@media (max-width: 960px) {
  .home-demo {
    grid-template-columns: 1fr;
    width: auto;
    margin-right: 0;
    margin-left: 0;
    transform: none;
  }

  .home-demo__intro h2 {
    max-width: 14ch;
    font-size: 3.2rem;
  }
}

@media (max-width: 640px) {
  .home-demo {
    margin-top: 2rem;
    padding: 16px;
  }

  .home-demo__steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-demo__intro h2 {
    font-size: 2.5rem;
  }

  .home-demo__workspace {
    min-height: 520px;
    padding-right: 0;
  }

  .home-demo__code {
    font-size: 0.74rem;
  }

  .home-demo__callout {
    right: 10px;
    width: calc(100% - 20px);
  }
}
</style>
