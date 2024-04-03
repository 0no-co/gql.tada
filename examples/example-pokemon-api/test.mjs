import { Project, ts } from "ts-morph";
import init from '@0no-co/graphqlsp'
import path from 'path';
import fs from 'fs';

export async function check() {
    const project = new Project({
        tsConfigFilePath: './tsconfig.json'
    });
    const plugin = init({
        typescript: ts
    })

    const languageService = project.getLanguageService()
    const createdPlugin = plugin.create({
        // TODO: add in config
        config: {
            schema: './schema.graphql',
            shouldCheckForColocatedFragments: false,
            trackFieldUsage: false
        },
        languageService: {
            ...languageService,
            getProgram: () => {
                const program = project.getProgram()
                return {
                    ...program,
                    getTypeChecker: () =>  project.getTypeChecker(),
                    getSourceFile: (s) => project.getSourceFile(s)
                }
            },
            getSemanticDiagnostics: () => [],
        },
        languageServiceHost: {},
        project: {
            getProjectName: () => path.resolve(process.cwd(), 'tsconfig.json'),
            readFile: (p) => {
                return fs.readFileSync(p);
            },
            projectService: {
                logger: console
            }
        },
        serverHost: {}
    })

    const diag = createdPlugin.getSemanticDiagnostics('./src/components/PokemonList.tsx')
    console.log('diag', diag)
}

check();
