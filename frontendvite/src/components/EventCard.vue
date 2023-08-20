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
                    
        <v-data-table
            v-model="selectedRows"
            dense
            :headers="headers"
            hide-default-footer
            :items="createArray"
            :items-per-page="-1"
            class="elevation-1"
            showSelect
        />
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
            selectedRows: []
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
    methods: {
        sumAttributeValues(attribute) {
            let t = 0
            if (attribute) {
                for (let i = 0; i < this.selectedRows.length; i++) {
                    t += this.selectedRows[i][attribute]
                }
            }
            return t
        }
    }
}
</script>

<style>

</style>