<template>
    <v-card>
        <v-card-title>{{ title }} ({{ id }})</v-card-title>
        <v-card-text>
            <v-row>
                <v-col align="start">
                    Tapahtumaan on myyty {{ expectedAttendance }} lippua. Lukuun ei sisälly paikattomat liput esim. seisomakatsomo tai aitiot.
                </v-col>
            </v-row>
            <v-row>
                <v-col align="start">
                    Tapahtumapaikassa on jäljellä {{ freeSeats }} istuinpaikkaa.
                </v-col>
            </v-row>
            <v-row>
                <v-col align="start">
                    Tapahtumapaikassa on yhteensä {{ totalSeats }} istuinpaikkaa.
                </v-col>
            </v-row>
        </v-card-text>
                    
        <v-divider class="mx-4"></v-divider>

        <div>

        <v-btn @click="removeZeros">
            {{ zerosRemoved ? 'Palauta' : 'Poista' }} nolla-katsomot
        </v-btn>

        <v-card-text>
            Valinta voi olla tarpeellinen, mikäli tapahtumassa on katsomolohkoja, joita ei ole avattu myyntiin.
        </v-card-text>
                    
        <!--
        <v-data-table
            v-model="selectedRows"
            dense
            :headers="headers"
            hide-default-footer
            :items="createArray"
            :items-per-page="-1"
            class="elevation-1"
            showSelect
        />-->

        <v-table v-show="showTable">
            <thead>
                <tr>
                    <th class="text-left">
                        Valinta
                    </th>
                    <th class="text-left">
                        Katsomolohko
                    </th>
                    <th class="text-left">
                        Vapaat
                    </th>
                    <th class="text-left">
                        Kaikki
                    </th>
                    <th class="text-left">
                        %
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(block, index) in createArray" v-bind:key=index>
                    <td>
                        <v-checkbox v-model="selectedBlocks[block.id]" />
                    </td>
                    <td>
                        {{ block.name }}
                    </td>
                    <td>
                        {{ block.seatsFree }}
                    </td>
                    <td>
                        {{ block.seatsTotal }}
                    </td>
                     <td>
                        {{ block.seatsFree }}
                    </td>
                </tr>
            </tbody>
        </v-table>

        </div>
    </v-card>
</template>

<script>
export default {
    props: {
        data: Object,
        id: String,
        title: String
    },
    data() {
        return {
            headers: [
                {
                    text: 'Lohkon nimi',
                    align: 'start',
                    sortable: true,
                    value: 'name',
                },
                {
                    text: 'Vapaat paikat',
                    align: 'start',
                    sortable: true,
                    value: 'seatsFree',
                },  
                {
                    text: 'Paikat yhteensä',
                    align: 'start',
                    sortable: true,
                    value: 'seatsTotal',
                },  
                {
                    text: 'Täynnä %',
                    align: 'start',
                    sortable: true,
                    value: 'percentsFree',
                },  
            ],
            selectedBlocks: {},
            selectedRows: [],
            showTable: true,
            zerosRemoved: false
        }
    },
    computed: {
        expectedAttendance() {
            return this.totalSeats - this.freeSeats
        },
        freeSeats() {
            return this.sumAttributeValues('seatsFree')
        },
        totalSeats() {
            return this.sumAttributeValues('seatsTotal')
        },
        createArray() {
            let arr = []
            if (this.data && this.data.blocks) {
                for (let block in this.data.blocks) {
                    arr.push(this.data.blocks[block])
                }
            }
            return arr
        }
    },
    watch: {
        selectedBlocks: {
            handler(v) {
                console.log(v)
            },
            deep: true
        }
    },
    created() {
        this.selectAll()
    },
    methods: {
        removeZeros() {
            this.zerosRemoved = !this.zerosRemoved
            if (this.data && this.data.blocks) {
                for (let block in this.data.blocks) {
                    if (this.data.blocks[block]['seatsFree'] === 0) {
                        this.selectedBlocks[block] = !this.zerosRemoved
                    }
                }
            }
        },
        selectAll() {
            let obj = {}
            if (this.data && this.data.blocks) {
                for (let block in this.data.blocks) {
                    obj[block] = true
                }
            }

            this.selectedBlocks = obj
        },
        sumAttributeValues(attribute) {

            /*
            let t = 0
            if (attribute) {
                for (let i = 0; i < this.selectedRows.length; i++) {
                    t += this.selectedRows[i][attribute]
                }
            }
            */

            let t = 0
            if (this.data && this.data.blocks) {
                for (let block in this.data.blocks) {
                    if (this.selectedBlocks[block]) {
                        t += this.data.blocks[block][attribute]
                    }
                }
            }

            return t
        }
    }
}
</script>

<style>

</style>