import { Project, ts } from "ts-morph";
import init from '@0no-co/graphqlsp'
import path from 'path';
import fs from 'fs';

export async function check() {
    const project = new Project({
        tsConfigFilePath: './tsconfig.json'
    });
    const plugin = init({
        typescript: ts as any
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
            getProgram: (() => {
                const program = project.getProgram()
                return {
                    ...program,
                    getTypeChecker: () =>  project.getTypeChecker(),
                    getSourceFile: (s) => project.getSourceFile(s)
                }
            }) as any,
            getSemanticDiagnostics: () => [],
        } as any,
        languageServiceHost: {} as any,
        project: {
            getProjectName: () => path.resolve(process.cwd(), 'tsconfig.json'),
            readFile: ((p) => {
                return fs.readFileSync(p);
            }) as any,
            projectService: {
                logger: console as any
            } as any
        } as any,
        serverHost: {} as any
    })

    const diag = createdPlugin.getSemanticDiagnostics('./src/components/PokemonList.tsx')
    console.log('diag', diag)
}

check();
