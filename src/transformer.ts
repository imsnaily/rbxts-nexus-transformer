import ts from "typescript";

const EVENT_HANDLER_DECORATOR = 'EventHandler';
const NEXUS_METADATA_CALL = 'NexusMetadata';
const NEXUS_PACKAGE = '@snailycfx/nexus';

export default function transformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
    const checker = program.getTypeChecker();

    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile): ts.SourceFile => {
            let needsImport = false;
            
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isClassDeclaration(node)) {
                    const updated = visitClassDeclaration(checker, context, node);
                    if (updated !== node) needsImport = true;

                    return updated;
                }

                if (
                    ts.isSourceFile(node) ||
                    ts.isModuleDeclaration(node) ||
                    ts.isModuleBlock(node)
                ) {
                    return ts.visitEachChild(node, visitor, context);
                }

                return node;
            }

            const updatedFile = ts.visitNode(sourceFile, visitor) as ts.SourceFile;
            if (!needsImport) return updatedFile;

            // we inject: import { NexusMetadata } from '@snailycfx/nexus'
            const nexusImport = ts.factory.createImportDeclaration(
                undefined,
                ts.factory.createImportClause(
                    false,
                    undefined,
                    ts.factory.createNamedImports([
                        ts.factory.createImportSpecifier(
                            false,
                            undefined,
                            ts.factory.createIdentifier(NEXUS_METADATA_CALL)
                        ),
                    ]),
                ),
                ts.factory.createStringLiteral(NEXUS_PACKAGE)
            );
            
            return ts.factory.updateSourceFile(updatedFile, [
                nexusImport,
                ...updatedFile.statements
            ])
        }
    }
}

function visitClassDeclaration(checker: ts.TypeChecker, context: ts.TransformationContext, classNode: ts.ClassDeclaration): ts.ClassDeclaration {
    const updatedMembers = classNode.members.map((member) => {
        if (!ts.isMethodDeclaration(member)) return member;
        if (!hasEventHandlerDecorator(member)) return member;

        return injectMetadata(checker, context, member);
    })

    return ts.factory.updateClassDeclaration(
        classNode,
        classNode.modifiers,
        classNode.name,
        classNode.typeParameters,
        classNode.heritageClauses,
        updatedMembers
    );
}

function injectMetadata(checker: ts.TypeChecker, context: ts.TransformationContext, method: ts.MethodDeclaration): ts.MethodDeclaration {
    const firstParam = method.parameters[0];
    if (firstParam === undefined) return method;

    const eventClassName = resolveParamTypeName(checker, firstParam);
    if (eventClassName === undefined) return method;

    // Generates: NexusMetadata.define('paramtypes', [EventClassName], target, 'methodName')
    const metadataCall = buildMetadataCall(method, eventClassName);
    const originalBody = method.body;
    
    if (originalBody === undefined) {
        return method;
    }

    const updatedBody = ts.factory.updateBlock(originalBody, [
        metadataCall,
        ...originalBody.statements
    ]);

    return ts.factory.updateMethodDeclaration(
        method,
        method.modifiers,
        method.asteriskToken,
        method.name,
        method.questionToken,
        method.typeParameters,
        method.parameters,
        method.type,
        updatedBody,
    );
}

function buildMetadataCall(
    method: ts.MethodDeclaration,
    eventClassName: string,
): ts.Statement {
    const methodName = (method.name as ts.Identifier).text;

    return ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(NEXUS_METADATA_CALL),
                ts.factory.createIdentifier("define"),
            ),
            undefined,
            [
                ts.factory.createStringLiteral("paramtypes"),
                ts.factory.createArrayLiteralExpression([
                    ts.factory.createIdentifier(eventClassName),
                ]),
                ts.factory.createStringLiteral(methodName),
            ],
        ),
    );
}

function hasEventHandlerDecorator(method: ts.MethodDeclaration): boolean {
    return (method.modifiers ?? []).some((modifier) => {
        if (!ts.isDecorator(modifier)) return false;

        const expression = modifier.expression;

        // @EventHandler() - CallExpression
        if (ts.isCallExpression(expression)) {
            const callee = expression.expression;
            return ts.isIdentifier(callee) && callee.text === EVENT_HANDLER_DECORATOR;
        }

        if (ts.isIdentifier(expression)) {
            return expression.text === EVENT_HANDLER_DECORATOR;
        }

        return false;
    })
}

function resolveParamTypeName(checker: ts.TypeChecker, param: ts.ParameterDeclaration): string | undefined {
    const typeNode = param.type;
    if (typeNode === undefined) return undefined;

    const type = checker.getTypeFromTypeNode(typeNode);
    const symbol = type.getSymbol();

    if (symbol === undefined) {
        return undefined;
    };

    return symbol.getName();
}