/** Mesmas chaves do português, com qualquer texto: o inglês e o espanhol não podem esquecer nem inventar chave. */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
